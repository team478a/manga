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

export const MONITOR_QUALITY_REVIEW_PILOT_CASE_COUNT = 28;

export type MonitorQualityReviewBatchTransition = "activate" | "pause" | "resume";

export type MonitorQualityReviewBatchReadinessCode =
  | "ready"
  | "batch_state_invalid"
  | "review_scope_invalid"
  | "source_package_invalid"
  | "rights_review_invalid"
  | "schedule_invalid"
  | "case_count_invalid"
  | "draft_assignment_exists";

export function evaluateMonitorQualityReviewBatchTransition(input: {
  transition: MonitorQualityReviewBatchTransition;
  batch: {
    status: string;
    reviewScope: string;
    sourcePackageSha256: string;
    rightsReviewedAt: string;
    rightsReviewedBy: string;
    startsAt: string;
    expiresAt: string;
  };
  caseCount: number;
  assignmentCount: number;
  now: Date;
}): { ready: boolean; code: MonitorQualityReviewBatchReadinessCode } {
  const expectedState = input.transition === "activate"
    ? "draft"
    : input.transition === "pause"
      ? "active"
      : "paused";
  if (input.batch.status !== expectedState)
    return { ready: false, code: "batch_state_invalid" };

  if (input.transition === "pause") return { ready: true, code: "ready" };
  if (input.batch.reviewScope !== "PILOT_INTRINSIC_ONLY")
    return { ready: false, code: "review_scope_invalid" };
  if (!/^[0-9a-f]{64}$/.test(input.batch.sourcePackageSha256))
    return { ready: false, code: "source_package_invalid" };

  const rightsReviewedAt = Date.parse(input.batch.rightsReviewedAt);
  if (!Number.isFinite(rightsReviewedAt) || rightsReviewedAt > input.now.getTime()
    || input.batch.rightsReviewedBy.trim().length < 3)
    return { ready: false, code: "rights_review_invalid" };

  const startsAt = Date.parse(input.batch.startsAt);
  const expiresAt = Date.parse(input.batch.expiresAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt)
    || expiresAt <= startsAt || expiresAt <= input.now.getTime())
    return { ready: false, code: "schedule_invalid" };
  if (input.caseCount !== MONITOR_QUALITY_REVIEW_PILOT_CASE_COUNT)
    return { ready: false, code: "case_count_invalid" };
  if (input.transition === "activate" && input.assignmentCount !== 0)
    return { ready: false, code: "draft_assignment_exists" };
  return { ready: true, code: "ready" };
}
