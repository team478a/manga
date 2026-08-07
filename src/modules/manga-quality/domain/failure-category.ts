export const MANGA_QUALITY_FAILURE_CATEGORIES = [
  "face_mismatch",
  "hand_error",
  "body_distortion",
  "wrong_character_count",
  "wrong_expression",
  "wrong_camera",
  "wrong_background",
  "missing_prop",
  "continuity_break",
  "text_area_collision",
  "low_readability",
  "other",
] as const;

export type MangaQualityFailureCategory =
  (typeof MANGA_QUALITY_FAILURE_CATEGORIES)[number];

export function isMangaQualityFailureCategory(
  value: string,
): value is MangaQualityFailureCategory {
  return MANGA_QUALITY_FAILURE_CATEGORIES.includes(
    value as MangaQualityFailureCategory,
  );
}
