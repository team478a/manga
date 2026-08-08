import { z } from "zod";
import { MANGA_QUALITY_FAILURE_CATEGORIES } from "./failure-category.ts";

export const panelQualityScoresSchema = z.object({
  characterMatchScore: z.number().min(0).max(100),
  expressionScore: z.number().min(0).max(100),
  compositionScore: z.number().min(0).max(100),
  backgroundScore: z.number().min(0).max(100),
  propScore: z.number().min(0).max(100),
  anatomyScore: z.number().min(0).max(100),
  continuityHintScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
});

export const panelQualityEvaluationSchema = z.object({
  specificationVersion: z.literal(1),
  scores: panelQualityScoresSchema,
  failureCategories: z.array(z.enum(MANGA_QUALITY_FAILURE_CATEGORIES)),
  displayBand: z.enum(["display", "needs_repair", "low_priority"]),
  evidence: z.record(z.string(), z.unknown()),
});

export type PanelQualityScores = z.infer<typeof panelQualityScoresSchema>;
export type PanelQualityEvaluation = z.infer<typeof panelQualityEvaluationSchema>;

export function classifyPanelQuality(overallScore: number) {
  if (overallScore >= 90) return "display" as const;
  if (overallScore >= 75) return "needs_repair" as const;
  return "low_priority" as const;
}
