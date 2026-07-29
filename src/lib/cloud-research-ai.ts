import { createHash } from "node:crypto";
import { z } from "zod";
import {
  cloudResearchInputSchema,
  type CloudResearchEvidence,
  type CloudResearchFinding,
  type CloudResearchRequest,
  type CloudResearchResult,
  evaluateCloudResearchQuality,
} from "./cloud-research.ts";
import { getCloudResearchAiRuntimeConfig } from "./cloud-research-ai-settings.ts";
import {
  ContentRejectedError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  RateLimitedError,
} from "./domain-errors.ts";

const findingKeys = [
  ["market_demand", "市場需要"],
  ["competition", "競合度"],
  ["reader_persona", "読者像"],
  ["popular_themes", "人気テーマ"],
  ["differentiation", "差別化案"],
  ["price", "価格帯"],
  ["channels", "販売チャネル"],
  ["risks", "リスク"],
  ["next_proposal", "次の企画への推奨条件"],
] as const;

const aiOutputSchema = z.object({
  market_demand: z.string().trim().min(1).max(1000),
  competition: z.string().trim().min(1).max(1000),
  reader_persona: z.string().trim().min(1).max(1000),
  popular_themes: z.string().trim().min(1).max(1000),
  differentiation: z.string().trim().min(1).max(1000),
  price: z.string().trim().min(1).max(1000),
  channels: z.string().trim().min(1).max(1000),
  risks: z.string().trim().min(1).max(1000),
  next_proposal: z.string().trim().min(1).max(1000),
});

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: findingKeys.map(([key]) => key),
  properties: Object.fromEntries(
    findingKeys.map(([key]) => [
      key,
      {
        type: "string",
        description:
          "出典で確認できる事実と、そこから導く慎重な提案。根拠のない数値は含めない。",
      },
    ]),
  ),
};

type Citation = { url: string; title: string };

function collectCitations(value: unknown, citations = new Map<string, string>()) {
  if (!value || typeof value !== "object") return citations;
  if (Array.isArray(value)) {
    for (const item of value) collectCitations(item, citations);
    return citations;
  }
  const object = value as Record<string, unknown>;
  if (
    object.type === "url_citation" &&
    typeof object.url === "string" &&
    object.url.startsWith("https://")
  ) {
    citations.set(
      object.url,
      typeof object.title === "string" && object.title.trim()
        ? object.title.trim().slice(0, 200)
        : new URL(object.url).hostname,
    );
  }
  for (const item of Object.values(object)) collectCitations(item, citations);
  return citations;
}

function extractOutputText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const response = value as Record<string, unknown>;
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return "";
  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) return text;
    }
  }
  return "";
}

function toEvidence(citations: Citation[], retrievedAt: string) {
  return citations.slice(0, 5).map(
    (citation): CloudResearchEvidence => ({
      title: citation.title,
      url: citation.url,
      retrievedAt,
      fact: "AI市場分析が参照した公開情報です。",
      sourceType: "other",
      topics: [
        "demand",
        "competition",
        "audience",
        "theme",
        "price",
        "channel",
        "risk",
      ],
    }),
  );
}

export async function runCloudResearchAiAnalysis(input: {
  profileId: string;
  request: CloudResearchRequest;
  fetchImplementation?: typeof fetch;
  now?: string;
  runtimeConfig?: Awaited<ReturnType<typeof getCloudResearchAiRuntimeConfig>>;
}): Promise<{ input: z.infer<typeof cloudResearchInputSchema>; result: CloudResearchResult }> {
  if (input.request.contentClass !== "general")
    throw new ContentRejectedError(
      "成人向け内容は外部AIへ送信しません。現在は一般向けAI市場分析のみ利用できます。",
    );
  const runtime =
    input.runtimeConfig ?? (await getCloudResearchAiRuntimeConfig());
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const generatedAt = input.now ?? new Date().toISOString();
  const response = await fetchImplementation("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: runtime.model,
      store: false,
      safety_identifier: createHash("sha256")
        .update(`mangai-research:${input.profileId}`)
        .digest("hex"),
      reasoning: { effort: "medium" },
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
      input: [
        {
          role: "system",
          content:
            "あなたは日本の漫画市場を調査するアナリストです。Web検索で信頼できる公開情報を確認し、事実と推論を混同せず、日本語で簡潔に分析してください。出典で確認できない市場規模、販売数、成長率、順位などの数値は生成しないでください。一般向け作品のみ扱ってください。",
        },
        {
          role: "user",
          content: JSON.stringify(input.request),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "mangai_market_research",
          strict: true,
          schema: responseJsonSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "TimeoutError")
      throw new ProviderTimeoutError(
        "AI市場分析に時間がかかっています。しばらくしてから再実行してください。",
      );
    throw new ProviderUnavailableError(
      "AI市場分析を開始できませんでした。しばらくしてから再実行してください。",
    );
  });
  if (response.status === 429)
    throw new RateLimitedError(
      "AI市場分析が混み合っています。しばらくしてから再実行してください。",
    );
  if (!response.ok)
    throw new ProviderUnavailableError(
      "AI市場分析を完了できませんでした。管理者へお問い合わせください。",
    );

  const payload: unknown = await response.json();
  const parsedOutput = aiOutputSchema.safeParse(
    JSON.parse(extractOutputText(payload)),
  );
  const citations = [...collectCitations(payload)].map(([url, title]) => ({
    url,
    title,
  }));
  if (!parsedOutput.success || citations.length === 0)
    throw new ProviderUnavailableError(
      "根拠を確認できる分析結果を作成できませんでした。条件を変えて再実行してください。",
    );
  const evidence = toEvidence(citations, generatedAt);
  const completedInput = cloudResearchInputSchema.parse({
    ...input.request,
    evidence,
  });
  const sourceUrls = evidence.map((source) => source.url);
  const findings: CloudResearchFinding[] = findingKeys.map(([key, label]) => ({
    key,
    label,
    summary: parsedOutput.data[key],
    classification: "ai_inference",
    sourceUrls,
    evidenceBasis: "ai_inference",
    confidence: citations.length >= 2 ? "medium" : "low",
    limitations:
      citations.length >= 2
        ? []
        : ["独立した複数出典での照合が不足しています。"],
  }));
  return {
    input: completedInput,
    result: {
      engineVersion: "openai-web-research-v1",
      generatedAt,
      containsGeneratedMarketNumbers: false,
      findings,
      quality: evaluateCloudResearchQuality(completedInput, generatedAt),
    },
  };
}
