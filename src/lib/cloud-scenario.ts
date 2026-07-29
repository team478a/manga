import { z } from "zod";
import type { CloudStoryProposalCandidate } from "./cloud-proposal.ts";
import { ContentRejectedError, ValidationError } from "./domain-errors.ts";

export const cloudScenarioFeatureEnabled = () =>
  process.env.CLOUD_SCENARIO_MVP_ENABLED?.toLowerCase() === "true";

export const scenarioRevisionFocusSchema = z.enum([
  "initial",
  "pacing",
  "character",
  "clarity",
]);
export type ScenarioRevisionFocus = z.infer<
  typeof scenarioRevisionFocusSchema
>;

const characterSchema = z.object({
  id: z.string().regex(/^character-[a-z]+$/),
  role: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  goal: z.string().min(1).max(1000),
  change: z.string().min(1).max(1000),
});

const actSchema = z.object({
  act: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  label: z.string().min(1).max(100),
  pageStart: z.number().int().min(1).max(2000),
  pageEnd: z.number().int().min(1).max(2000),
  purpose: z.string().min(1).max(1000),
  turningPoint: z.string().min(1).max(1000),
});

const sceneSchema = z.object({
  id: z.string().regex(/^scene-\d{2}$/),
  order: z.number().int().min(1).max(20),
  pageStart: z.number().int().min(1).max(2000),
  pageEnd: z.number().int().min(1).max(2000),
  heading: z.string().min(1).max(200),
  purpose: z.string().min(1).max(1000),
  summary: z.string().min(1).max(2000),
  characters: z.array(z.string().min(1).max(100)).min(1).max(10),
  dialogueGoal: z.string().min(1).max(1000),
  visualBeat: z.string().min(1).max(1000),
});

export const cloudScenarioResultSchema = z.object({
  engineVersion: z.literal("scenario-rules-v1"),
  generatedAt: z.string().datetime(),
  classification: z.literal("ai_inference"),
  revisionFocus: scenarioRevisionFocusSchema,
  title: z.string().min(1).max(200),
  logline: z.string().min(1).max(1000),
  totalPages: z.number().int().min(1).max(2000),
  characters: z.array(characterSchema).length(3),
  acts: z.array(actSchema).length(3),
  scenes: z.array(sceneSchema).min(1).max(8),
  continuityChecks: z.array(z.string().min(1).max(500)).min(1).max(10),
  proposalTrace: z.object({
    proposalSelectionId: z.string().uuid(),
    candidateId: z.string().min(1).max(100),
    researchReportId: z.string().uuid(),
    sourceUrls: z.array(z.string().url()).min(1).max(5),
  }),
});
export type CloudScenarioResult = z.infer<typeof cloudScenarioResultSchema>;

type ScenarioInput = {
  proposalSelectionId: string;
  researchReportId: string;
  candidate: CloudStoryProposalCandidate;
  totalPages: number;
  contentClass: "general" | "adult";
  focus?: ScenarioRevisionFocus;
};

function allocateScenes(totalPages: number) {
  const sceneCount = Math.min(8, totalPages);
  const base = Math.floor(totalPages / sceneCount);
  const remainder = totalPages % sceneCount;
  let page = 1;
  return Array.from({ length: sceneCount }, (_, index) => {
    const size = base + (index < remainder ? 1 : 0);
    const range = { pageStart: page, pageEnd: page + size - 1 };
    page += size;
    return range;
  });
}

function actRanges(totalPages: number) {
  const actOneEnd = Math.max(1, Math.floor(totalPages * 0.25));
  const actTwoStart = Math.min(totalPages, actOneEnd + 1);
  const actTwoEnd = Math.max(actTwoStart, Math.floor(totalPages * 0.75));
  const actThreeStart = Math.min(totalPages, actTwoEnd + 1);
  return [
    { pageStart: 1, pageEnd: actOneEnd },
    { pageStart: actTwoStart, pageEnd: actTwoEnd },
    { pageStart: actThreeStart, pageEnd: totalPages },
  ];
}

const focusNotes: Record<ScenarioRevisionFocus, string> = {
  initial: "企画の読者への約束と中心対立を素直に展開する",
  pacing: "各シーンの目的を一つに絞り、転換を早める",
  character: "主人公の選択理由と感情変化を場面ごとに強める",
  clarity: "状況、目的、障害を読者が迷わない順番で提示する",
};

export function runCloudScenario(
  input: ScenarioInput,
  generatedAt = new Date().toISOString(),
): CloudScenarioResult {
  if (input.contentClass !== "general")
    throw new ContentRejectedError(
      "成人向けシナリオはCloudでは生成できません。MANGAI Desktop Adultを利用してください。",
    );
  if (!Number.isInteger(input.totalPages) || input.totalPages < 1 || input.totalPages > 2000)
    throw new ValidationError("市場分析Reportのページ数を確認してください。");
  if (!input.candidate.sourceUrls.length)
    throw new ValidationError("出典追跡情報を持つ採用企画が必要です。");

  const focus = input.focus ?? "initial";
  const ranges = allocateScenes(input.totalPages);
  const templates = [
    ["日常と不足", "主人公の現在地と欠けているものを示す。", "主人公の日常に、目的を急がせる小さな異変が起きる。"],
    ["事件の発生", "物語の目的と期限を明確にする。", "避けられない事件によって、主人公が行動を選ばされる。"],
    ["最初の選択", "主人公を後戻りできない状況へ進める。", "主人公は不完全な情報のまま、最初の決断を下す。"],
    ["対立の拡大", "協力者と障害の利害を衝突させる。", "一時的な成功の代償として、中心対立が深まる。"],
    ["真実と損失", "主人公の前提を崩す。", "隠されていた事実が明らかになり、守りたいものを失う。"],
    ["再選択", "内面の変化を行動で示す。", "主人公は以前なら避けた選択を、自分の意思で引き受ける。"],
    ["決着", "中心対立へ不可逆な答えを出す。", "主人公と対立者の目的が正面からぶつかり、結果が確定する。"],
    ["余韻", "読者への約束を回収する。", "変化した日常を示し、テーマへの作品なりの答えを残す。"],
  ];
  const scenes = ranges.map((range, index) => {
    const templateIndex =
      ranges.length === 1
        ? 6
        : Math.round((index * (templates.length - 1)) / (ranges.length - 1));
    const [heading, purpose, summary] = templates[templateIndex];
    return {
      id: `scene-${String(index + 1).padStart(2, "0")}`,
      order: index + 1,
      ...range,
      heading,
      purpose: `${purpose}${focusNotes[focus]}。`,
      summary: `${summary}${input.candidate.centralConflict}`,
      characters:
        index === 0
          ? ["主人公"]
          : index === ranges.length - 1
            ? ["主人公", "対立者"]
            : ["主人公", index % 2 ? "対立者" : "協力者"],
      dialogueGoal:
        focus === "character"
          ? "説明ではなく、望みと恐れのずれから感情変化を伝える。"
          : "場面の目的と次の行動を、短いやり取りで前進させる。",
      visualBeat:
        focus === "pacing"
          ? "場面の最後に選択・発見・危機のいずれかを一枚で示す。"
          : "人物の距離、視線、反応で関係の変化を見せる。",
    };
  });

  const rangesByAct = actRanges(input.totalPages);
  return cloudScenarioResultSchema.parse({
    engineVersion: "scenario-rules-v1",
    generatedAt,
    classification: "ai_inference",
    revisionFocus: focus,
    title: input.candidate.title,
    logline: input.candidate.logline,
    totalPages: input.totalPages,
    characters: [
      {
        id: "character-lead",
        role: "主人公",
        description: input.candidate.protagonist,
        goal: "中心対立に対して、自分の判断で答えを出す。",
        change: "他者や状況に決められた基準から、自分で選んだ基準へ移る。",
      },
      {
        id: "character-counterpart",
        role: "対立者",
        description: "主人公と同じ問題に異なる正解を持ち、行動によって反論する存在。",
        goal: "主人公とは両立しない方法で、自分が守るものを維持する。",
        change: "主人公の決断によって、自分の正しさの代償と向き合う。",
      },
      {
        id: "character-ally",
        role: "協力者",
        description: "主人公を助けながら、都合のよい同意だけは与えない存在。",
        goal: "主人公が選択から逃げず、結果を引き受ける状態へ導く。",
        change: "保護する関係から、対等に任せる関係へ変わる。",
      },
    ],
    acts: [
      {
        act: 1,
        label: "設定",
        ...rangesByAct[0],
        purpose: "主人公、目的、期限、障害を提示する。",
        turningPoint: "主人公が後戻りできない最初の選択をする。",
      },
      {
        act: 2,
        label: "対立",
        ...rangesByAct[1],
        purpose: "試行と失敗を重ね、中心対立の代償を具体化する。",
        turningPoint: "主人公の前提が崩れ、最も大きな損失に直面する。",
      },
      {
        act: 3,
        label: "決着",
        ...rangesByAct[2],
        purpose: "変化した主人公の選択で中心対立へ答えを出す。",
        turningPoint: "決断の結果と、新しい日常を示す。",
      },
    ],
    scenes,
    continuityChecks: [
      "主人公の目的、期限、障害が冒頭で矛盾なく提示されているか。",
      "各シーンの結果が次のシーンの原因になっているか。",
      "中心対立の決着が主人公自身の選択によって生じているか。",
      `全シーンのページ範囲が1〜${input.totalPages}Pageを重複なく覆っているか。`,
      "参考作品の固有表現・人物・設定を模倣していないか。",
    ],
    proposalTrace: {
      proposalSelectionId: input.proposalSelectionId,
      candidateId: input.candidate.id,
      researchReportId: input.researchReportId,
      sourceUrls: input.candidate.sourceUrls,
    },
  });
}
