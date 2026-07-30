import { z } from "zod";
import { ContentRejectedError, ValidationError } from "./domain-errors.ts";

export const cloudResearchFeatureEnabled = () =>
  process.env.CLOUD_RESEARCH_MVP_ENABLED?.toLowerCase() === "true";

export const cloudResearchSourceTypeSchema = z.enum([
  "official",
  "platform",
  "industry_report",
  "news",
  "store_ranking",
  "other",
]);
export const cloudResearchTopicSchema = z.enum([
  "demand",
  "competition",
  "audience",
  "theme",
  "price",
  "channel",
  "risk",
]);
export type CloudResearchTopic = z.infer<typeof cloudResearchTopicSchema>;

const sourceVerificationSchema = z.object({
  status: z.literal("verified"),
  checkedAt: z.string().datetime(),
  finalUrl: z.string().url(),
  contentType: z.string().min(1).max(200),
  byteSize: z.number().int().min(1).max(1_000_000),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  documentTitle: z.string().max(300).optional(),
});
export type CloudResearchSourceVerification = z.infer<
  typeof sourceVerificationSchema
>;

const evidenceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.string().url().refine((value) => value.startsWith("https://"), {
    message: "出典URLはHTTPSで入力してください。",
  }),
  retrievedAt: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
  fact: z.string().trim().min(1).max(1000),
  sourceType: cloudResearchSourceTypeSchema,
  topics: z.array(cloudResearchTopicSchema).min(1).max(7),
  verification: sourceVerificationSchema.optional(),
}).refine(
  (value) =>
    !value.publishedAt ||
    new Date(value.publishedAt).getTime() <=
      new Date(value.retrievedAt).getTime(),
  {
    message: "出典の公開日時は取得日時以前にしてください。",
    path: ["publishedAt"],
  },
);

export const cloudResearchRequestSchema = z.object({
  genre: z.string().trim().min(1).max(80),
  audience: z.string().trim().min(1).max(300),
  platform: z.string().trim().min(1).max(120),
  contentClass: z.enum(["general", "adult"]),
  theme: z.string().trim().min(1).max(300),
  referenceWorks: z.string().trim().min(1).max(500),
  priceMin: z.coerce.number().int().min(0).max(1_000_000),
  priceMax: z.coerce.number().int().min(0).max(1_000_000),
  publicationFormat: z.enum(["auto", "series", "one_shot"]),
  pageCount: z.coerce.number().int().min(0).max(2000),
})
  .refine((value) => value.priceMin <= value.priceMax, {
    message: "価格帯は下限を上限以下にしてください。",
    path: ["priceMax"],
  });

export const cloudResearchInputSchema = cloudResearchRequestSchema.extend({
  evidence: z.array(evidenceSchema).min(1).max(5),
})
  .refine((value) => value.priceMin <= value.priceMax, {
    message: "価格帯は下限を上限以下にしてください。",
    path: ["priceMax"],
  })
  .refine(
    (value) =>
      new Set(value.evidence.map((item) => item.url)).size ===
      value.evidence.length,
    {
      message: "同じ出典URLを重複して登録できません。",
      path: ["evidence"],
    },
  );

export type CloudResearchInput = z.infer<typeof cloudResearchInputSchema>;
export type CloudResearchRequest = z.infer<typeof cloudResearchRequestSchema>;
export type CloudResearchEvidence = CloudResearchInput["evidence"][number];
export type FindingClassification = "fact" | "ai_inference";
export type CloudResearchFinding = {
  key: string;
  label: string;
  summary: string;
  classification: FindingClassification;
  sourceUrls: string[];
  evidenceBasis?: "source_fact" | "user_input" | "ai_inference";
  confidence?: "low" | "medium" | "high";
  limitations?: string[];
};
export type CloudResearchQuality = {
  score: number;
  level: "low" | "medium" | "high";
  independentDomains: number;
  freshSourceCount: number;
  verifiedSourceCount?: number;
  coveragePercent: number;
  missingTopics: CloudResearchTopic[];
  warnings: string[];
};
export type CloudResearchResult = {
  engineVersion:
    | "research-rules-v1"
    | "research-rules-v2"
    | "openai-web-research-v1";
  generatedAt: string;
  containsGeneratedMarketNumbers: false;
  findings: CloudResearchFinding[];
  quality?: CloudResearchQuality;
};

function requiredText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function toIsoDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function parseCloudResearchForm(
  formData: FormData,
  options: { allowAdult?: boolean } = {},
) {
  const evidence = [0, 1, 2, 3, 4]
    .map((index) => ({
      title: requiredText(formData, `sourceTitle${index}`),
      url: requiredText(formData, `sourceUrl${index}`),
      retrievedAt: toIsoDateTime(
        requiredText(formData, `sourceRetrievedAt${index}`),
      ),
      publishedAt: toIsoDateTime(
        requiredText(formData, `sourcePublishedAt${index}`),
      ) || undefined,
      fact: requiredText(formData, `sourceFact${index}`),
      sourceType: requiredText(formData, `sourceType${index}`),
      topics: formData
        .getAll(`sourceTopics${index}`)
        .map((value) => String(value)),
    }))
    .filter((item) => item.title || item.url || item.fact);

  const parsed = cloudResearchInputSchema.safeParse({
    genre: requiredText(formData, "genre"),
    audience: requiredText(formData, "audience"),
    platform: requiredText(formData, "platform"),
    contentClass: requiredText(formData, "contentClass"),
    theme: requiredText(formData, "theme"),
    referenceWorks: requiredText(formData, "referenceWorks"),
    priceMin: requiredText(formData, "priceMin"),
    priceMax: requiredText(formData, "priceMax"),
    publicationFormat: requiredText(formData, "publicationFormat"),
    pageCount: requiredText(formData, "pageCount"),
    evidence,
  });
  if (!parsed.success)
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "市場分析の入力を確認してください。",
    );
  if (parsed.data.contentClass === "adult" && !options.allowAdult)
    throw new ContentRejectedError(
      "成人向け市場分析はCloudでは実行できません。MANGAI Desktop Adultを利用してください。",
    );
  return parsed.data;
}

export function parseCloudResearchRequestForm(formData: FormData) {
  const priceBand = requiredText(formData, "priceBand");
  const priceBands: Record<string, [number, number]> = {
    auto: [0, 0],
    free: [0, 0],
    low: [100, 499],
    standard: [500, 999],
    premium: [1000, 1999],
    high: [2000, 10000],
  };
  const selectedPrice = priceBands[priceBand];
  if (!selectedPrice)
    throw new ValidationError("価格帯を選択してください。");
  const parsed = cloudResearchRequestSchema.safeParse({
    genre: requiredText(formData, "genre"),
    audience: requiredText(formData, "audience"),
    platform: requiredText(formData, "platform"),
    contentClass: requiredText(formData, "contentClass"),
    theme: requiredText(formData, "theme"),
    referenceWorks:
      requiredText(formData, "referenceWorks") || "指定なし",
    priceMin: selectedPrice[0],
    priceMax: selectedPrice[1],
    publicationFormat: requiredText(formData, "publicationFormat"),
    pageCount: requiredText(formData, "pageCount"),
  });
  if (!parsed.success)
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? "市場分析の入力を確認してください。",
    );
  return parsed.data;
}

export function runCloudMarketAnalysis(
  input: CloudResearchInput,
  generatedAt = new Date().toISOString(),
): CloudResearchResult {
  const formatLabel =
    input.publicationFormat === "auto"
      ? "AI推奨形式"
      : input.publicationFormat === "series"
        ? "連載"
        : "読切";
  const evidenceFor = (...topics: CloudResearchTopic[]) =>
    input.evidence.filter((item) =>
      item.topics.some((topic) => topics.includes(topic)),
    );
  const urlsFor = (...topics: CloudResearchTopic[]) =>
    [...new Set(evidenceFor(...topics).map((item) => item.url))];
  const factsFor = (...topics: CloudResearchTopic[]) =>
    evidenceFor(...topics).map((item) => item.fact).join("／");
  const quality = evaluateCloudResearchQuality(input, generatedAt);
  const inferred = (
    topics: CloudResearchTopic[],
    summary: string,
  ): Pick<
    CloudResearchFinding,
    "summary" | "classification" | "sourceUrls" | "evidenceBasis" | "confidence" | "limitations"
  > => {
    const urls = urlsFor(...topics);
    return {
      summary,
      classification: "ai_inference",
      sourceUrls: urls,
      evidenceBasis: "ai_inference",
      confidence:
        urls.length >= 2 && quality.level === "high"
          ? "high"
          : urls.length >= 1
            ? "medium"
            : "low",
      limitations: urls.length
        ? []
        : [`${topics.join("・")}分野の直接根拠が登録されていません。`],
    };
  };
  const userInput = (summary: string) => ({
    summary,
    classification: "fact" as const,
    sourceUrls: [],
    evidenceBasis: "user_input" as const,
    confidence: "medium" as const,
    limitations: ["利用者が指定した制作条件であり、市場事実ではありません。"],
  });
  return {
    engineVersion: "research-rules-v2",
    generatedAt,
    containsGeneratedMarketNumbers: false,
    quality,
    findings: [
      {
        key: "market_demand",
        label: "市場需要",
        ...inferred(
          ["demand"],
          factsFor("demand")
            ? `需要分野の出典では「${factsFor("demand")}」が確認されています。${input.audience}向けの${input.genre}として需要仮説を検証してください。`
            : `${input.audience}向けの${input.genre}という需要仮説は、需要分野の出典を追加して検証してください。`,
        ),
      },
      {
        key: "competition",
        label: "競合度",
        ...inferred(
          ["competition"],
          `${input.platform}上の参考作品（${input.referenceWorks}）と同じ訴求だけでは競合しやすいため、競合分野の出典と訴求軸を照合してください。`,
        ),
      },
      {
        key: "reader_persona",
        label: "読者像",
        ...userInput(input.audience),
      },
      {
        key: "popular_themes",
        label: "人気テーマ",
        ...inferred(
          ["theme"],
          factsFor("theme")
            ? `入力テーマ「${input.theme}」と、テーマ分野の事実「${factsFor("theme")}」の重なりを優先候補とします。`
            : `入力テーマ「${input.theme}」の人気度は、テーマ分野の出典を追加して検証してください。`,
        ),
      },
      {
        key: "differentiation",
        label: "差別化案",
        ...inferred(
          ["competition", "theme"],
          `${formatLabel}${input.pageCount}Pageの制約を活かし、参考作品と異なる主人公の目的・舞台・読後感のうち最低1つを企画条件にしてください。`,
        ),
      },
      {
        key: "price",
        label: "価格帯",
        ...userInput(
          `検討価格は${input.priceMin.toLocaleString("ja-JP")}円〜${input.priceMax.toLocaleString("ja-JP")}円です。`,
        ),
      },
      {
        key: "channels",
        label: "販売チャネル",
        ...inferred(
          ["channel"],
          `主チャネル候補は${input.platform}です。手数料・表現規定・読者導線をチャネル分野の公式情報で再確認してください。`,
        ),
      },
      {
        key: "risks",
        label: "リスク",
        ...inferred(
          ["risk"],
          "出典の更新、参考作品への過度な類似、プラットフォーム規約、価格とPage数の不整合を主要確認項目とします。",
        ),
      },
      {
        key: "next_proposal",
        label: "次の企画への推奨条件",
        ...userInput(
          `${input.genre}／${input.theme}／${input.audience}／${formatLabel}${input.pageCount}Page／${input.platform}を企画提案の必須条件として引き継ぎます。`,
        ),
      },
    ],
  };
}

const sourceWeights: Record<CloudResearchInput["evidence"][number]["sourceType"], number> = {
  official: 100,
  platform: 90,
  industry_report: 85,
  store_ranking: 75,
  news: 65,
  other: 40,
};

export function evaluateCloudResearchQuality(
  input: CloudResearchInput,
  evaluatedAt = new Date().toISOString(),
): CloudResearchQuality {
  const allTopics = cloudResearchTopicSchema.options;
  const covered = new Set(input.evidence.flatMap((item) => item.topics));
  const missingTopics = allTopics.filter((topic) => !covered.has(topic));
  const domains = new Set(
    input.evidence.map((item) => new URL(item.url).hostname.replace(/^www\./, "")),
  );
  const evaluatedTime = new Date(evaluatedAt).getTime();
  const sourceAges = input.evidence.map(
    (item) => evaluatedTime - new Date(item.retrievedAt).getTime(),
  );
  const freshSourceCount = sourceAges.filter(
    (age) => age >= 0 && age <= 180 * 24 * 60 * 60 * 1000,
  ).length;
  const futureSourceCount = sourceAges.filter((age) => age < 0).length;
  const staleSourceCount = sourceAges.filter(
    (age) => age > 180 * 24 * 60 * 60 * 1000,
  ).length;
  const verifiedSourceCount = input.evidence.filter(
    (item) => item.verification?.status === "verified",
  ).length;
  const authority =
    input.evidence.reduce(
      (total, item) => total + sourceWeights[item.sourceType],
      0,
    ) / input.evidence.length;
  const coveragePercent = Math.round((covered.size / allTopics.length) * 100);
  const score = Math.round(
    authority * 0.25 +
      Math.min(domains.size / 3, 1) * 25 +
      (coveragePercent / 100) * 25 +
      (freshSourceCount / input.evidence.length) * 15 +
      (verifiedSourceCount / input.evidence.length) * 10,
  );
  const warnings = [
    ...(domains.size < 2 ? ["独立した2ドメイン以上での照合がありません。"] : []),
    ...(staleSourceCount
      ? ["取得から180日を超える出典が含まれます。"]
      : []),
    ...(futureSourceCount
      ? ["評価時点より未来の取得日時を持つ出典が含まれます。"]
      : []),
    ...(verifiedSourceCount < input.evidence.length
      ? ["Serverで取得検証されていない出典が含まれます。"]
      : []),
    ...(missingTopics.length
      ? [`根拠が不足する分野: ${missingTopics.join("、")}`]
      : []),
  ];
  return {
    score,
    level: score >= 80 ? "high" : score >= 55 ? "medium" : "low",
    independentDomains: domains.size,
    freshSourceCount,
    verifiedSourceCount,
    coveragePercent,
    missingTopics,
    warnings,
  };
}
