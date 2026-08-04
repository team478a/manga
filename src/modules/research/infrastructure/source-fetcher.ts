import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type {
  CloudResearchInput,
  CloudResearchSourceVerification,
} from "../domain/research-report.ts";
import type { CloudResearchSourceSnapshot } from "../domain/evidence.ts";
import {
  PayloadTooLargeError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  ValidationError,
} from "../../../lib/domain-errors.ts";

const MAX_SOURCE_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 7_000;
const allowedContentTypes = new Set([
  "text/html",
  "text/plain",
  "application/json",
]);

type LookupResult = { address: string; family: number };
export type VerificationDependencies = {
  fetcher?: typeof fetch;
  lookup?: (hostname: string) => Promise<LookupResult[]>;
  now?: () => Date;
  allowedHosts?: string[];
};

export type { CloudResearchSourceSnapshot } from "../domain/evidence.ts";

export const cloudResearchSourceVerificationEnabled = () =>
  process.env.CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED?.toLowerCase() ===
  "true";

export function configuredResearchSourceHosts() {
  return [
    ...new Set(
      (process.env.CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS ?? "")
        .split(",")
        .map((host) => host.trim().toLowerCase().replace(/\.$/, ""))
        .filter(Boolean),
    ),
  ];
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part)))
    return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 88 && parts[2] === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && parts[2] === 100) ||
    (a === 203 && b === 0 && parts[2] === 113) ||
    a >= 224
  );
}

export function isPublicResearchAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return !isPrivateIpv4(address);
  if (version !== 6) return false;
  const normalized = address.toLowerCase().split("%")[0];
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    /^2001:0?db8:/.test(normalized)
  )
    return false;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped ? !isPrivateIpv4(mapped) : true;
}

function validateSourceUrl(rawUrl: string, allowedHosts: string[]) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ValidationError("出典URLを確認してください。");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(hostname)
  )
    throw new ValidationError(
      "出典検証は許可されたHTTPSドメインだけを利用できます。",
    );
  if (!allowedHosts.includes(hostname))
    throw new ValidationError(
      "この出典ドメインはServer検証の許可対象ではありません。",
    );
  url.hash = "";
  return url;
}

async function resolvePublicAddresses(
  hostname: string,
  resolver: (hostname: string) => Promise<LookupResult[]>,
) {
  let addresses: LookupResult[];
  try {
    addresses = await resolver(hostname);
  } catch {
    throw new ProviderUnavailableError(
      "出典ドメインの安全性を確認できませんでした。",
    );
  }
  if (
    !addresses.length ||
    addresses.some((entry) => !isPublicResearchAddress(entry.address))
  )
    throw new ValidationError(
      "公開ネットワーク以外を指す出典URLは検証できません。",
    );
}

async function readLimitedBody(response: Response) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_SOURCE_BYTES)
    throw new PayloadTooLargeError("出典本文が検証上限を超えています。");
  if (!response.body)
    throw new ValidationError("出典本文を取得できませんでした。");

  const chunks: Uint8Array[] = [];
  let byteSize = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteSize += value.byteLength;
    if (byteSize > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new PayloadTooLargeError("出典本文が検証上限を超えています。");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteSize);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function decodeBytes(bytes: Uint8Array, rawContentType: string) {
  const charset = rawContentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1];
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
    (entity, token: string) => {
      const normalized = token.toLowerCase();
      if (normalized.startsWith("#")) {
        const codePoint = normalized.startsWith("#x")
          ? Number.parseInt(normalized.slice(2), 16)
          : Number.parseInt(normalized.slice(1), 10);
        return Number.isInteger(codePoint) &&
          codePoint >= 0 &&
          codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : entity;
      }
      return named[normalized] ?? entity;
    },
  );
}

function normalizeDocumentText(value: string) {
  const seen = new Set<string>();
  return value
    .normalize("NFKC")
    .split(/\r?\n/u)
    .map((line) => line.replace(/[\t\f\v ]+/gu, " ").trim())
    .filter((line) => {
      if (line.length < 3 || seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .join("\n")
    .trim();
}

function htmlDocumentText(html: string) {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(
      /<(script|style|noscript|svg|template|nav|footer|header|aside|form)\b[^>]*>[\s\S]*?<\/\1\s*>/giu,
      " ",
    )
    .replace(/<(br|hr)\b[^>]*\/?>/giu, "\n")
    .replace(
      /<\/?(article|blockquote|dd|div|dl|dt|figcaption|figure|h[1-6]|li|main|p|section|table|tbody|td|th|thead|tr|ul|ol)\b[^>]*>/giu,
      "\n",
    )
    .replace(/<[^>]+>/gu, " ");
  return normalizeDocumentText(decodeHtmlEntities(withoutNoise));
}

function jsonDocumentText(raw: string) {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return normalizeDocumentText(raw);
  }
  const lines: string[] = [];
  let textLength = 0;
  const push = (line: string) => {
    if (textLength >= 200_000) return;
    lines.push(line);
    textLength += line.length + 1;
  };
  const visit = (entry: unknown, depth: number) => {
    if (depth > 8 || textLength >= 200_000) return;
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      push(String(entry));
      return;
    }
    if (Array.isArray(entry)) {
      for (const item of entry.slice(0, 1_000)) visit(item, depth + 1);
      return;
    }
    if (entry && typeof entry === "object") {
      for (const [key, item] of Object.entries(entry).slice(0, 1_000)) {
        push(key);
        visit(item, depth + 1);
      }
    }
  };
  visit(value, 0);
  return normalizeDocumentText(lines.join("\n"));
}

function documentText(
  bytes: Uint8Array,
  contentType: string,
  rawContentType: string,
) {
  const decoded = decodeBytes(bytes, rawContentType);
  if (contentType === "text/html") return htmlDocumentText(decoded);
  if (contentType === "application/json") return jsonDocumentText(decoded);
  return normalizeDocumentText(decoded);
}

function documentTitle(html: string, contentType: string) {
  if (contentType !== "text/html") return undefined;
  const rawTitle = html.match(
    /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i,
  )?.[1];
  const title = rawTitle
    ? decodeHtmlEntities(rawTitle.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300)
    : "";
  return title || undefined;
}

export async function verifyCloudResearchSource(
  rawUrl: string,
  dependencies: VerificationDependencies = {},
): Promise<CloudResearchSourceVerification> {
  return (await fetchCloudResearchSourceSnapshot(rawUrl, dependencies))
    .verification;
}

export async function fetchCloudResearchSourceSnapshot(
  rawUrl: string,
  dependencies: VerificationDependencies = {},
): Promise<CloudResearchSourceSnapshot> {
  const allowedHosts =
    dependencies.allowedHosts ?? configuredResearchSourceHosts();
  if (!allowedHosts.length)
    throw new ProviderUnavailableError(
      "出典検証の許可ドメインが設定されていません。",
    );
  const fetcher = dependencies.fetcher ?? fetch;
  const resolver =
    dependencies.lookup ??
    (async (hostname: string) =>
      dnsLookup(hostname, { all: true, verbatim: true }));
  let current = validateSourceUrl(rawUrl, allowedHosts);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await resolvePublicAddresses(current.hostname, resolver);
    let response: Response;
    try {
      response = await fetcher(current, {
        cache: "no-store",
        headers: {
          accept: "text/html,text/plain,application/json;q=0.8",
          "user-agent": "MANGAI-Research-Source-Verifier/1.0",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      )
        throw new ProviderTimeoutError("出典の取得がタイムアウトしました。");
      throw new ProviderUnavailableError("出典を取得できませんでした。");
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS)
        throw new ValidationError("出典のリダイレクトを検証できません。");
      await response.body?.cancel();
      current = validateSourceUrl(new URL(location, current).toString(), allowedHosts);
      continue;
    }
    if (!response.ok)
      throw new ValidationError("出典URLから正常な応答を取得できません。");

    const rawContentType = response.headers.get("content-type") ?? "";
    const contentType = rawContentType
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!allowedContentTypes.has(contentType))
      throw new ValidationError(
        "出典検証はHTML、テキスト、JSONだけに対応しています。",
      );
    const bytes = await readLimitedBody(response);
    if (!bytes.byteLength)
      throw new ValidationError("出典本文が空です。");
    const decoded = decodeBytes(bytes, rawContentType);
    const fullText = documentText(bytes, contentType, rawContentType);
    const text = fullText.slice(0, 200_000);
    const verification = {
      status: "verified",
      checkedAt: (dependencies.now?.() ?? new Date()).toISOString(),
      finalUrl: current.toString(),
      contentType,
      byteSize: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      documentTitle: documentTitle(decoded, contentType),
    } satisfies CloudResearchSourceVerification;
    return {
      verification,
      text,
      textSha256: createHash("sha256").update(text, "utf8").digest("hex"),
      textTruncated: fullText.length > text.length,
    };
  }
  throw new ValidationError("出典のリダイレクトを検証できません。");
}

export async function verifyCloudResearchSources(
  input: CloudResearchInput,
  dependencies: VerificationDependencies = {},
): Promise<CloudResearchInput> {
  const evidence = [];
  for (const source of input.evidence) {
    evidence.push({
      ...source,
      verification: await verifyCloudResearchSource(source.url, dependencies),
    });
  }
  return { ...input, evidence };
}

export async function maybeVerifyCloudResearchSources(
  input: CloudResearchInput,
) {
  return cloudResearchSourceVerificationEnabled()
    ? verifyCloudResearchSources(input)
    : input;
}
