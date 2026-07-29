import { z } from "zod";
import { ContentRejectedError, ValidationError } from "./domain-errors.ts";

export const cloudResearchFeatureEnabled = () =>
  process.env.CLOUD_RESEARCH_MVP_ENABLED?.toLowerCase() !== "false";

const evidenceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.string().url().refine((value) => value.startsWith("https://"), {
    message: "出典URLはHTTPSで入力してください。",
  }),
  retrievedAt: z.string().datetime(),
  fact: z.string().trim().min(1).max(1000),
});

export const cloudResearchInputSchema = z.object({
  genre: z.string().trim().min(1).max(80),
  audience: z.string().trim().min(1).max(300),
  platform: z.string().trim().min(1).max(120),
  contentClass: z.enum(["general", "adult"]),
  theme: z.string().trim().min(1).max(300),
  referenceWorks: z.string().trim().min(1).max(500),
  priceMin: z.coerce.number().int().min(0).max(1_000_000),
  priceMax: z.coerce.number().int().min(0).max(1_000_000),
  publicationFormat: z.enum(["series", "one_shot"]),
  pageCount: z.coerce.number().int().min(1).max(2000),
  evidence: z.array(evidenceSchema).min(1).max(5),
}).refine((value) => value.priceMin <= value.priceMax, {
  message: "価格帯は下限を上限以下にしてください。",
  path: ["priceMax"],
});

export type CloudResearchInput = z.infer<typeof cloudResearchInputSchema>;
export type CloudResearchEvidence = CloudResearchInput["evidence"][number];
export type FindingClassification = "fact" | "ai_inference";
export type CloudResearchFinding = {
  key: string;
  label: string;
  summary: string;
  classification: FindingClassification;
  sourceUrls: string[];
};
export type CloudResearchResult = {
  engineVersion: "research-rules-v1";
  generatedAt: string;
  containsGeneratedMarketNumbers: false;
  findings: CloudResearchFinding[];
};

function requiredText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export function parseCloudResearchForm(formData: FormData) {
  const evidence = [0, 1, 2, 3, 4]
    .map((index) => ({
      title: requiredText(formData, `sourceTitle${index}`),
      url: requiredText(formData, `sourceUrl${index}`),
      retrievedAt: requiredText(formData, `sourceRetrievedAt${index}`)
        ? new Date(requiredText(formData, `sourceRetrievedAt${index}`)).toISOString()
        : "",
      fact: requiredText(formData, `sourceFact${index}`),
    }))
    .filter((item) => item.title || item.url || item.fact || item.retrievedAt);

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
  if (parsed.data.contentClass === "adult")
    throw new ContentRejectedError(
      "成人向け市場分析はCloudでは実行できません。MANGAI Desktop Adultを利用してください。",
    );
  return parsed.data;
}

export function runCloudMarketAnalysis(
  input: CloudResearchInput,
  generatedAt = new Date().toISOString(),
): CloudResearchResult {
  const urls = input.evidence.map((item) => item.url);
  const facts = input.evidence.map((item) => item.fact).join("／");
  const formatLabel = input.publicationFormat === "series" ? "連載" : "読切";
  return {
    engineVersion: "research-rules-v1",
    generatedAt,
    containsGeneratedMarketNumbers: false,
    findings: [
      {
        key: "market_demand",
        label: "市場需要",
        summary: `確認済み出典では「${facts}」が示されています。${input.audience}向けの${input.genre}として需要仮説を検証してください。`,
        classification: "ai_inference",
        sourceUrls: urls,
      },
      {
        key: "competition",
        label: "競合度",
        summary: `${input.platform}上の参考作品（${input.referenceWorks}）と同じ訴求だけでは競合しやすいため、公開前に作品一覧と訴求軸を再確認してください。`,
        classification: "ai_inference",
        sourceUrls: urls,
      },
      {
        key: "reader_persona",
        label: "読者像",
        summary: input.audience,
        classification: "fact",
        sourceUrls: urls,
      },
      {
        key: "popular_themes",
        label: "人気テーマ",
        summary: `入力テーマ「${input.theme}」と、出典で確認した事実「${facts}」の重なりを優先候補とします。`,
        classification: "ai_inference",
        sourceUrls: urls,
      },
      {
        key: "differentiation",
        label: "差別化案",
        summary: `${formatLabel}${input.pageCount}Pageの制約を活かし、参考作品と異なる主人公の目的・舞台・読後感のうち最低1つを企画条件にしてください。`,
        classification: "ai_inference",
        sourceUrls: urls,
      },
      {
        key: "price",
        label: "価格帯",
        summary: `検討価格は${input.priceMin.toLocaleString("ja-JP")}円〜${input.priceMax.toLocaleString("ja-JP")}円です。市場価格の事実ではなく、利用者が入力した検討条件として保存します。`,
        classification: "fact",
        sourceUrls: urls,
      },
      {
        key: "channels",
        label: "販売チャネル",
        summary: `主チャネル候補は${input.platform}です。各チャネルの手数料・表現規定・読者導線は公開前に公式情報で再確認してください。`,
        classification: "ai_inference",
        sourceUrls: urls,
      },
      {
        key: "risks",
        label: "リスク",
        summary: "出典の更新、参考作品への過度な類似、プラットフォーム規約、価格とPage数の不整合を主要確認項目とします。",
        classification: "ai_inference",
        sourceUrls: urls,
      },
      {
        key: "next_proposal",
        label: "次の企画への推奨条件",
        summary: `${input.genre}／${input.theme}／${input.audience}／${formatLabel}${input.pageCount}Page／${input.platform}を企画提案の必須条件として引き継ぎます。`,
        classification: "ai_inference",
        sourceUrls: urls,
      },
    ],
  };
}
