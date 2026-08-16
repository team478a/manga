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
 * R4-3A compatibility only. Runtime failure classification remains unchanged
 * until R4-3C replaces the rule-based ranking contract.
 */
export const visualJudgeFailureCompatibilityMap: Record<
  VisualJudgeFailureCategory,
  MangaQualityFailureCategory
> = {
  character_mismatch: "face_mismatch",
  face_mismatch: "face_mismatch",
  body_distortion: "body_distortion",
  hand_error: "hand_error",
  body_prop_fusion: "body_distortion",
  wrong_character_count: "wrong_character_count",
  wrong_expression: "wrong_expression",
  wrong_camera: "wrong_camera",
  crop_mismatch: "wrong_camera",
  wrong_background: "wrong_background",
  missing_prop: "missing_prop",
  prop_fusion: "missing_prop",
  continuity_break: "continuity_break",
  text_artifact: "text_area_collision",
  ui_artifact: "text_area_collision",
  orientation_error: "other",
  gravity_error: "other",
  low_readability: "low_readability",
  other: "other",
};
