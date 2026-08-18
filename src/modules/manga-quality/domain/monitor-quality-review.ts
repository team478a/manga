import { z } from "zod";
import {
  HUMAN_REVIEW_DEFECT_CATEGORIES,
  INTRINSIC_REVIEW_DEFECT_CATEGORIES,
  humanReviewRecordSchema,
} from "./human-review-package.ts";

export const monitorQualityReviewDefectCategorySchema = z.enum(
  HUMAN_REVIEW_DEFECT_CATEGORIES,
);

export const monitorQualityReviewDraftSchema = z
  .object({
    caseId: z.string().uuid(),
    verdict: z.enum(["good", "borderline", "bad"]).nullable(),
    confidence: z.number().int().min(1).max(5).nullable(),
    defects: z.array(z.object({
      category: monitorQualityReviewDefectCategorySchema,
      severity: z.enum(["minor", "major", "critical"]),
      comment: z.string().trim().max(1_000).default(""),
    }).strict()).max(30),
    overallComment: z.string().trim().max(2_000),
    complete: z.boolean().default(false),
  })
  .strict();

export type MonitorQualityReviewDraft = z.infer<
  typeof monitorQualityReviewDraftSchema
>;

export function validateCompletedMonitorQualityReview(input: {
  caseKey: string;
  allowedDefectCategories: string[];
  draft: MonitorQualityReviewDraft;
}) {
  const record = humanReviewRecordSchema.parse({
    case_id: input.caseKey,
    verdict: input.draft.verdict,
    confidence: input.draft.confidence,
    defects: input.draft.defects,
    overall_comment: input.draft.overallComment,
  });
  for (const defect of record.defects) {
    if (!input.allowedDefectCategories.includes(defect.category))
      throw new Error("monitor_quality_review_category_not_allowed");
  }
  return record;
}

export const MONITOR_INTRINSIC_DEFECT_CATEGORIES = [
  ...INTRINSIC_REVIEW_DEFECT_CATEGORIES,
] as const;

export const MONITOR_QUALITY_REVIEW_LABELS = {
  anatomy_hand_error: "手・指の形",
  anatomy_body_distortion: "体の形",
  object_fusion: "人物や物の不自然な融合",
  unwanted_text: "意図しない文字",
  unwanted_ui: "意図しない画面・UI",
  unwanted_logo: "意図しないロゴ",
  crop_error: "不自然な切れ・見切れ",
  orientation_error: "上下・向きの誤り",
  gravity_error: "重力・姿勢の不自然さ",
  low_readability: "見づらさ・判別しづらさ",
  other: "その他",
} as const satisfies Partial<Record<
  (typeof HUMAN_REVIEW_DEFECT_CATEGORIES)[number],
  string
>>;
