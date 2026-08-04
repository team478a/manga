import { isIP } from "node:net";
import { z } from "zod";
import type {
  CloudResearchSearchCandidate,
  CloudResearchSearchInput,
  CloudResearchSearchResult,
} from "../contracts/research-search.ts";
import { cloudResearchSearchInputSchema } from "../contracts/research-search.ts";
import type { CloudResearchSearchProvider } from "../application/discover-sources.ts";
import { cloudResearchTopicSchema } from "../domain/research-report.ts";
import { configuredResearchSourceHosts } from "./source-fetcher.ts";
import {
  PayloadTooLargeError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  RateLimitedError,
  ValidationError,
} from "../../../lib/domain-errors.ts";

const BRAVE_SEARCH_ENDPOINT =
  "https://api.search.brave.com/res/v1/web/search";
const SEARCH_TIMEOUT_MS = 7_000;
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_RESULTS = 10;

export const cloudResearchSearchEnabled = () =>
  process.env.CLOUD_RESEARCH_SEARCH_ENABLED?.toLowerCase() === "true";

export {
  cloudResearchSearchInputSchema,
  type CloudResearchSearchCandidate,
  type CloudResearchSearchInput,
  type CloudResearchSearchResult,
} from "../contracts/research-search.ts";
export type { CloudResearchSearchProvider } from "../application/discover-sources.ts";

const cloudResearchSearchAdoptionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().max(4000),
  topic: cloudResearchTopicSchema,
  publishedAt: z.string().datetime().optional(),
});

const braveResponseSchema = z.object({
  web: z
    .object({
      results: z.array(
        z.object({
          title: z.string().min(1).max(1000),
          url: z.string().min(1).max(4000),
          description: z.string().max(5000).optional(),
          page_age: z.string().optional(),
          age: z.string().optional(),
        }),
      ),
    })
    .optional(),
});

function normalizeCandidateUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return undefined;
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(hostname)
  )
    return undefined;
  url.hostname = hostname;
  url.hash = "";
  return { url: url.toString(), hostname };
}

export function parseCloudResearchSearchAdoption(value: {
  title?: string;
  url?: string;
  topic?: string;
  publishedAt?: string;
}) {
  const parsed = cloudResearchSearchAdoptionSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const normalized = normalizeCandidateUrl(parsed.data.url);
  if (!normalized) return undefined;
  return { ...parsed.data, url: normalized.url };
}

function parsePublishedAt(value?: string) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : undefined;
}

async function readJsonWithLimit(response: Response) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES)
    throw new PayloadTooLargeError("検索結果が応答上限を超えています。");
  if (!response.body)
    throw new ProviderUnavailableError("検索結果を取得できませんでした。");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new PayloadTooLargeError("検索結果が応答上限を超えています。");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ProviderUnavailableError(
      "検索Providerの応答を確認できませんでした。",
    );
  }
}

function mapCandidates(
  value: z.infer<typeof braveResponseSchema>,
): CloudResearchSearchCandidate[] {
  const allowedHosts = configuredResearchSourceHosts();
  const seen = new Set<string>();
  const candidates: CloudResearchSearchCandidate[] = [];
  for (const result of value.web?.results ?? []) {
    const normalized = normalizeCandidateUrl(result.url);
    const title = result.title.replace(/\s+/gu, " ").trim().slice(0, 200);
    if (!normalized || !title || seen.has(normalized.url)) continue;
    seen.add(normalized.url);
    candidates.push({
      title,
      url: normalized.url,
      description: result.description
        ?.replace(/\s+/gu, " ")
        .trim()
        .slice(0, 500),
      publishedAt: parsePublishedAt(result.page_age ?? result.age),
      verificationEligible: allowedHosts.includes(normalized.hostname),
    });
    if (candidates.length === MAX_RESULTS) break;
  }
  return candidates;
}

export class BraveCloudResearchSearchProvider
  implements CloudResearchSearchProvider
{
  readonly providerId = "brave-web-search" as const;
  private readonly config: {
    apiKey: string;
    fetcher?: typeof fetch;
    now?: () => Date;
  };

  constructor(config: {
    apiKey: string;
    fetcher?: typeof fetch;
    now?: () => Date;
  }) {
    if (!config.apiKey)
      throw new ProviderUnavailableError("検索Providerが設定されていません。");
    this.config = config;
  }

  async search(rawInput: CloudResearchSearchInput) {
    const parsed = cloudResearchSearchInputSchema.safeParse(rawInput);
    if (!parsed.success)
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "検索条件を確認してください。",
      );
    const input = parsed.data;
    const endpoint = new URL(BRAVE_SEARCH_ENDPOINT);
    endpoint.searchParams.set("q", input.query);
    endpoint.searchParams.set("country", "JP");
    endpoint.searchParams.set("search_lang", "ja");
    endpoint.searchParams.set("ui_lang", "ja-JP");
    endpoint.searchParams.set("count", String(MAX_RESULTS));
    endpoint.searchParams.set("safesearch", "strict");
    endpoint.searchParams.set("result_filter", "web");
    endpoint.searchParams.set("text_decorations", "false");
    if (input.freshness === "month") endpoint.searchParams.set("freshness", "pm");
    if (input.freshness === "year") endpoint.searchParams.set("freshness", "py");

    let response: Response;
    try {
      response = await (this.config.fetcher ?? fetch)(endpoint, {
        cache: "no-store",
        headers: {
          accept: "application/json",
          "x-subscription-token": this.config.apiKey,
        },
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      )
        throw new ProviderTimeoutError("出典検索がタイムアウトしました。");
      throw new ProviderUnavailableError("出典検索へ接続できませんでした。");
    }
    if (response.status === 429)
      throw new RateLimitedError(
        "出典検索の利用上限に達しました。後でもう一度お試しください。",
      );
    if (!response.ok)
      throw new ProviderUnavailableError("出典検索を実行できませんでした。");
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (contentType !== "application/json")
      throw new ProviderUnavailableError(
        "検索Providerの応答を確認できませんでした。",
      );

    const providerValue = await readJsonWithLimit(response);
    const providerResponse = braveResponseSchema.safeParse(providerValue);
    if (!providerResponse.success)
      throw new ProviderUnavailableError(
        "検索Providerの応答を確認できませんでした。",
      );
    return {
      provider: this.providerId,
      searchedAt: (this.config.now?.() ?? new Date()).toISOString(),
      topic: input.topic,
      candidates: mapCandidates(providerResponse.data),
    };
  }
}

export function configuredCloudResearchSearchProvider() {
  if (!cloudResearchSearchEnabled())
    throw new ProviderUnavailableError("出典候補検索は現在停止中です。");
  return new BraveCloudResearchSearchProvider({
    apiKey: process.env.BRAVE_SEARCH_API_KEY ?? "",
  });
}
