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
import {
  providerSpecificRequestFields,
  resolveCloudTextProviderRuntime,
  type CloudTextProviderRuntimeOverride,
} from "./cloud-text-provider-runtime.ts";
import {
  ContentRejectedError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  RateLimitedError,
} from "./domain-errors.ts";
import { reviewAdultGenerationPrompt } from "@mangai/ai-core";

const findingKeys = [
  ["winning_direction", "今、狙う作品"],
  ["why_it_sells", "買われる理由"],
  ["recommended_product", "おすすめの商品設計"],
  ["market_demand", "今の需要"],
  ["competition", "競合と狙い目"],
  ["reader_persona", "購入しそうな読者"],
  ["popular_themes", "反応されやすいテーマ"],
  ["differentiation", "選ばれるための違い"],
  ["price", "おすすめ価格"],
  ["channels", "おすすめ販売先"],
  ["risks", "売れにくくなる要因"],
  ["next_proposal", "次に作る企画の条件"],
] as const;

const aiOutputSchema = z.object({
  winning_direction: z.string().trim().min(1).max(1000),
  why_it_sells: z.string().trim().min(1).max(1000),
  recommended_product: z.string().trim().min(1).max(1000),
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
          "公開情報から確認した現在の傾向を根拠に、専門用語を使わず具体的な制作判断を示す。根拠のない数値は含めない。",
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

async function runResearchAiAnalysis(input: {
  profileId: string;
  request: CloudResearchRequest;
  contentClass: "general" | "adult";
  fetchImplementation?: typeof fetch;
  now?: string;
  runtimeConfig?: CloudTextProviderRuntimeOverride;
}): Promise<{ input: z.infer<typeof cloudResearchInputSchema>; result: CloudResearchResult }> {
  if (input.request.contentClass !== input.contentClass)
    throw new ContentRejectedError("市場分析の区分を確認してください。");
  if (
    input.contentClass === "adult" &&
    !reviewAdultGenerationPrompt(JSON.stringify(input.request)).allowed
  )
    throw new ContentRejectedError(
      "安全条件を満たさないため成人向け市場分析を実行できません。",
    );
  const runtime =
    await resolveCloudTextProviderRuntime(input.contentClass, input.runtimeConfig);
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const generatedAt = input.now ?? new Date().toISOString();
  const response = await fetchImplementation(runtime.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: runtime.model,
      store: false,
      ...providerSpecificRequestFields(
        runtime,
        createHash("sha256")
          .update(`mangai-research:${input.profileId}`)
          .digest("hex"),
      ),
      reasoning: { effort: "medium" },
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
      input: [
        {
          role: "system",
          content:
            [
              input.contentClass === "adult"
                ? "あなたは日本の成人向け電子漫画市場に詳しい商品企画責任者です。"
                : "あなたは日本の電子漫画市場に詳しい商品企画責任者です。",
              "利用者が知りたい最重要事項は「今、どんな漫画なら買われる可能性が高いか」です。",
              "Web検索を使い、公式ストアの特集・ランキング・カテゴリ情報、出版社や電子書店の公開情報、信頼できる業界情報から、現在の需要、競合、購入動機、価格、販売先を調べてください。",
              "直近12か月の情報を優先し、需要を示す情報と競合を示す情報を、異なる2ドメイン以上で確認してください。",
              "単なる人気ジャンルではなく、需要が確認でき、競合と違う購入理由を作れる隙間を探してください。",
              "winning_directionでは、ジャンル、読者、感情的な魅力、物語のフックを組み合わせ、最もおすすめする作品像を一つだけ具体的に示してください。",
              "why_it_sellsでは、その作品が買われると考える理由を、現在確認できる需要と競合状況から説明してください。",
              "recommended_productでは、連載か読切、適切なボリューム、価格帯、最初に出す販売先を一つの実行案として示してください。",
              "入力値が「AIにおまかせ」、形式がauto、価格が0〜0円、ページ数が0なら、その条件は制約ではなく、調査結果から最適案を選んでください。",
              "利用者が指定した条件より売れやすい代替案がある場合は、理由とともに提案してください。",
              "曖昧な一般論や「検討してください」だけで終わらず、次に何を作るか判断できる日本語で簡潔に書いてください。",
              "売上を保証せず、出典で確認できない市場規模、販売数、成長率、順位などの数値は生成しないでください。",
              input.contentClass === "adult"
                ? "事実とAIの提案を混同せず、架空かつ明示的に18歳以上の成人による合意のある非搾取的な作品だけを扱ってください。未成年・年齢不詳・実在人物・非同意・搾取的内容は禁止です。露骨な描写ではなく市場・商品設計を分析してください。"
                : "事実とAIの提案を混同せず、一般向け作品だけを扱ってください。",
            ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            analysisDate: generatedAt,
            objective: "買われる可能性が高い漫画の商品企画を一つ決める",
            preferences: input.request,
          }),
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
  const citationDomains = new Set(
    citations.map((citation) => new URL(citation.url).hostname.toLowerCase()),
  );
  if (!parsedOutput.success || citationDomains.size < 2)
    throw new ProviderUnavailableError(
      "十分な根拠を確認できる分析結果を作成できませんでした。条件を変えて再実行してください。",
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
    confidence: "medium",
    limitations: [],
  }));
  if (
    input.contentClass === "adult" &&
    !reviewAdultGenerationPrompt(JSON.stringify(findings)).allowed
  )
    throw new ContentRejectedError(
      "安全条件を満たさない分析結果が含まれたため保存しませんでした。",
    );
  return {
    input: completedInput,
    result: {
      engineVersion:
        runtime.provider === "xai"
          ? "xai-adult-web-research-v1"
          : "openai-web-research-v1",
      generatedAt,
      containsGeneratedMarketNumbers: false,
      findings,
      quality: evaluateCloudResearchQuality(completedInput, generatedAt),
    },
  };
}

export async function runCloudResearchAiAnalysis(
  input: Omit<Parameters<typeof runResearchAiAnalysis>[0], "contentClass">,
) {
  return runResearchAiAnalysis({ ...input, contentClass: "general" });
}

export async function runCloudAdultResearchAiAnalysis(
  input: Omit<Parameters<typeof runResearchAiAnalysis>[0], "contentClass">,
) {
  return runResearchAiAnalysis({ ...input, contentClass: "adult" });
}
