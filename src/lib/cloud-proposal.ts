import { z } from "zod";
import type {
  CloudResearchFinding,
  CloudResearchInput,
} from "./cloud-research.ts";
import { evaluateCloudProposalQuality } from "./cloud-proposal-quality.ts";
import { ContentRejectedError, ValidationError } from "./domain-errors.ts";

export const cloudProposalFeatureEnabled = () =>
  process.env.CLOUD_PROPOSAL_MVP_ENABLED?.toLowerCase() === "true";

export const cloudProposalDirectionSchema = z.enum([
  "balanced",
  "differentiated",
  "focused",
]);
export type CloudProposalDirection = z.infer<
  typeof cloudProposalDirectionSchema
>;

export const cloudStoryProposalCandidateSchema = z.object({
  id: z.string().regex(/^candidate-(balanced|differentiated|focused)$/),
  direction: cloudProposalDirectionSchema,
  title: z.string().min(1).max(200),
  logline: z.string().min(1).max(1000),
  readerPromise: z.string().min(1).max(1000),
  protagonist: z.string().min(1).max(1000),
  centralConflict: z.string().min(1).max(1000),
  setting: z.string().min(1).max(1000),
  theme: z.string().min(1).max(500),
  differentiation: z.string().min(1).max(1000),
  formatPlan: z.string().min(1).max(1000),
  salesPositioning: z.string().min(1).max(1000),
  risks: z.array(z.string().min(1).max(500)).min(1).max(5),
  researchFindingKeys: z.array(z.string().min(1).max(100)).min(1).max(20),
  sourceUrls: z.array(z.string().url()).min(1).max(5),
});
export type CloudStoryProposalCandidate = z.infer<
  typeof cloudStoryProposalCandidateSchema
>;

export const cloudStoryProposalResultSchema = z.object({
  engineVersion: z.literal("proposal-rules-v1"),
  generatedAt: z.string().datetime(),
  classification: z.literal("ai_inference"),
  containsGeneratedMarketNumbers: z.literal(false),
  candidates: z.array(cloudStoryProposalCandidateSchema).length(3),
});
export type CloudStoryProposalResult = z.infer<
  typeof cloudStoryProposalResultSchema
>;

type ProposalResearch = {
  input: CloudResearchInput;
  findings: CloudResearchFinding[];
  sourceUrls: string[];
};

function finding(research: ProposalResearch, key: string) {
  return (
    research.findings.find((item) => item.key === key)?.summary ??
    "市場分析Reportの条件を優先する"
  );
}

function formatLabel(input: CloudResearchInput) {
  return input.publicationFormat === "series" ? "連載" : "読切";
}

export function runCloudStoryProposal(
  research: ProposalResearch,
  generatedAt = new Date().toISOString(),
): CloudStoryProposalResult {
  if (research.input.contentClass !== "general")
    throw new ContentRejectedError(
      "成人向け企画はCloudでは生成できません。MANGAI Desktop Adultを利用してください。",
    );
  const sources = [...new Set(research.sourceUrls)];
  if (!sources.length)
    throw new ValidationError("出典付きの市場分析Reportが必要です。");

  const common = {
    theme: research.input.theme,
    formatPlan: `${formatLabel(research.input)}・全${research.input.pageCount}Pageを上限とし、導入・転換・決着の配分を次工程で確定します。`,
    salesPositioning: `${research.input.platform}向け。入力済み検討価格${research.input.priceMin.toLocaleString("ja-JP")}〜${research.input.priceMax.toLocaleString("ja-JP")}円の範囲で、公開前に公式条件を再確認します。`,
    risks: [
      finding(research, "risks"),
      "参考作品の固有表現・人物・設定を模倣せず、類似性を公開前に確認する。",
    ],
    researchFindingKeys: [
      "reader_persona",
      "popular_themes",
      "differentiation",
      "risks",
      "next_proposal",
    ],
    sourceUrls: sources,
  };

  const candidates: CloudStoryProposalCandidate[] = [
    {
      ...common,
      id: "candidate-balanced",
      direction: "balanced",
      title: `${research.input.theme.slice(0, 180)}をめぐる選択`,
      logline: `${research.input.genre}の世界で、身近な目標を持つ主人公が相反する二つの選択に直面し、${research.input.theme}の意味を問い直す物語。`,
      readerPromise: `${research.input.audience}が状況を理解しやすく、感情の変化と決断を最後まで追える企画です。`,
      protagonist: "読者と同じ目線から始まり、失敗を通じて自分の判断基準を獲得する主人公。",
      centralConflict: "達成したい個人的な目標と、守るべき他者への責任が同時には満たせない。",
      setting: `${research.input.genre}の魅力が一目で伝わり、限られたPage数でもルールを説明できる舞台。`,
      differentiation: finding(research, "differentiation"),
    },
    {
      ...common,
      id: "candidate-differentiated",
      direction: "differentiated",
      title: `${research.input.theme.slice(0, 190)}の反転`,
      logline: `常識とされている価値観を疑う主人公が、味方だと思っていた存在との対立を通じて、${research.input.theme}を逆方向から描く${research.input.genre}。`,
      readerPromise: "既視感のある入口から予想を反転させ、読後に最初の場面を読み返したくなる企画です。",
      protagonist: "周囲の常識を信じて行動するが、その常識の受益者でもあったことに気づく主人公。",
      centralConflict: "真実を公表すれば大切な関係を失い、隠せば自分も問題の一部になる。",
      setting: "表向きのルールと実際の運用が異なり、主人公の選択で二面性が見える舞台。",
      differentiation: `${finding(research, "differentiation")} 視点の反転を中心にし、参考作品と異なる読後感を設計します。`,
    },
    {
      ...common,
      id: "candidate-focused",
      direction: "focused",
      title: `${research.input.theme.slice(0, 186)}までの期限`,
      logline: `期限までに一つの目的を達成しなければならない主人公が、最大の障害となる相手と協力せざるを得なくなる${research.input.genre}。`,
      readerPromise: `${research.input.audience}に向けて、目的・期限・障害を早く提示し、続きが気になる推進力を優先します。`,
      protagonist: "明確な得意分野を持つ一方、他者へ助けを求めることだけが苦手な主人公。",
      centralConflict: "単独では間に合わないが、協力相手を信じる根拠もない。",
      setting: "移動範囲と登場人物を絞り、Pageごとに期限が近づくことを視覚化できる舞台。",
      differentiation: `${finding(research, "differentiation")} 読者への約束を一つに絞り、冒頭で明示します。`,
    },
  ];

  const result = cloudStoryProposalResultSchema.parse({
    engineVersion: "proposal-rules-v1",
    generatedAt,
    classification: "ai_inference",
    containsGeneratedMarketNumbers: false,
    candidates,
  });
  const quality = evaluateCloudProposalQuality(
    result,
    research.input,
    research.findings,
  );
  if (!quality.passed)
    throw new ValidationError(
      "企画候補の品質確認を完了できませんでした。市場分析の入力内容を確認してください。",
    );
  return result;
}
