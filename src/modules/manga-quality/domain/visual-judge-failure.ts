import type { MangaQualityFailureCategory } from "./failure-category.ts";

export const VISUAL_JUDGE_FAILURE_CATEGORIES = [
  "character_mismatch",
  "face_mismatch",
  "body_distortion",
  "hand_error",
  "body_prop_fusion",
  "wrong_character_count",
  "wrong_expression",
  "wrong_camera",
  "crop_mismatch",
  "wrong_background",
  "missing_prop",
  "prop_fusion",
  "continuity_break",
  "text_artifact",
  "ui_artifact",
  "orientation_error",
  "gravity_error",
  "low_readability",
  "other",
] as const;

export type VisualJudgeFailureCategory =
  (typeof VISUAL_JUDGE_FAILURE_CATEGORIES)[number];

/**
 * R4-3A benchmark vocabulary is additive. Only semantically identical runtime
 * categories are exposed here; callers must preserve `null` when no equivalent
 * exists instead of coercing a benchmark finding into another meaning.
 */
const exactRuntimeEquivalents: Partial<
  Record<VisualJudgeFailureCategory, MangaQualityFailureCategory>
> = {
  character_mismatch: "face_mismatch",
  face_mismatch: "face_mismatch",
  body_distortion: "body_distortion",
  hand_error: "hand_error",
  wrong_character_count: "wrong_character_count",
  wrong_expression: "wrong_expression",
  wrong_camera: "wrong_camera",
  wrong_background: "wrong_background",
  missing_prop: "missing_prop",
  continuity_break: "continuity_break",
  low_readability: "low_readability",
  other: "other",
};

export function toExactRuntimeFailureCategory(
  category: VisualJudgeFailureCategory,
): MangaQualityFailureCategory | null {
  return exactRuntimeEquivalents[category] ?? null;
}
