import { z } from "zod";
import { VISUAL_JUDGE_FAILURE_CATEGORIES } from "./visual-judge-failure.ts";

export const EVIDENCE_STATUSES = ["ok", "unknown", "not_evaluated"] as const;
export const EVIDENCE_SOURCES = ["vlm", "embedding", "detector", "rule"] as const;

const evidenceValueBaseSchema = z.object({
  status: z.enum(EVIDENCE_STATUSES),
  score: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().min(1).max(200).optional(),
  source: z.enum(EVIDENCE_SOURCES),
});

export const evidenceValueSchema = evidenceValueBaseSchema.superRefine(
  (value, context) => {
    if (value.status === "ok" && value.score === null)
      context.addIssue({
        code: "custom",
        path: ["score"],
        message: "ok evidence requires a score",
      });
    if (value.status !== "ok" && value.score !== null)
      context.addIssue({
        code: "custom",
        path: ["score"],
        message: "unknown evidence cannot carry a score",
      });
  },
);

export const detectedCharacterCountEvidenceSchema = evidenceValueBaseSchema
  .extend({ detectedCount: z.number().int().min(0).max(12).nullable() })
  .superRefine((value, context) => {
    if (value.status === "ok" && value.score === null)
      context.addIssue({
        code: "custom",
        path: ["score"],
        message: "ok evidence requires a score",
      });
    if (value.status !== "ok" && value.score !== null)
      context.addIssue({
        code: "custom",
        path: ["score"],
        message: "unknown evidence cannot carry a score",
      });
    if (value.status === "ok" && value.detectedCount === null)
      context.addIssue({
        code: "custom",
        path: ["detectedCount"],
        message: "evaluated character count requires an observed count",
      });
    if (value.status !== "ok" && value.detectedCount !== null)
      context.addIssue({
        code: "custom",
        path: ["detectedCount"],
        message: "unknown character count cannot carry an observed count",
      });
  });

export const VISUAL_EVIDENCE_KEYS = [
  "characterMatch",
  "expressionMatch",
  "compositionMatch",
  "backgroundMatch",
  "propMatch",
  "anatomyQuality",
  "orientationQuality",
  "textArtifactRisk",
  "styleConsistency",
  "continuityMatch",
  "detectedCharacterCount",
] as const;

export const BASE_REQUIRED_EVIDENCE_KEYS = [
  "characterMatch",
  "compositionMatch",
  "anatomyQuality",
  "orientationQuality",
  "textArtifactRisk",
  "detectedCharacterCount",
] as const;

export const visualEvidenceSchema = z.object({
  characterMatch: evidenceValueSchema,
  expressionMatch: evidenceValueSchema,
  compositionMatch: evidenceValueSchema,
  backgroundMatch: evidenceValueSchema,
  propMatch: evidenceValueSchema,
  anatomyQuality: evidenceValueSchema,
  orientationQuality: evidenceValueSchema,
  textArtifactRisk: evidenceValueSchema,
  styleConsistency: evidenceValueSchema,
  continuityMatch: evidenceValueSchema,
  detectedCharacterCount: detectedCharacterCountEvidenceSchema,
});

export const visualEvidenceResultSchema = z
  .object({
    version: z.literal(1),
    judgeId: z.string().trim().min(1).max(100),
    evidence: visualEvidenceSchema,
    suggestedFailureCategories: z
      .array(z.enum(VISUAL_JUDGE_FAILURE_CATEGORIES))
      .max(VISUAL_JUDGE_FAILURE_CATEGORIES.length),
    criticalFailure: z.boolean(),
    estimatedJudgeCostMicros: z.number().int().min(0).nullable(),
    latencyMs: z.number().int().min(0).nullable(),
  })
  .superRefine((value, context) => {
    if (
      new Set(value.suggestedFailureCategories).size !==
      value.suggestedFailureCategories.length
    )
      context.addIssue({
        code: "custom",
        path: ["suggestedFailureCategories"],
        message: "failure categories must be unique",
      });
  });

export const qualityCoverageSchema = z.object({
  evidenceCoverage: z.number().min(0).max(1),
  requiredEvidenceComplete: z.boolean(),
  evaluatedCount: z.number().int().min(0),
  totalExpectedCount: z.number().int().min(1),
});

export type EvidenceValue = z.infer<typeof evidenceValueSchema>;
export type VisualEvidence = z.infer<typeof visualEvidenceSchema>;
export type VisualEvidenceResult = z.infer<typeof visualEvidenceResultSchema>;
export type QualityCoverage = z.infer<typeof qualityCoverageSchema>;

export function calculateQualityCoverage(
  evidence: VisualEvidence,
  options: { continuityRequired?: boolean } = {},
): QualityCoverage {
  const expectedKeys = VISUAL_EVIDENCE_KEYS.filter(
    (key) => key !== "continuityMatch" || options.continuityRequired,
  );
  const requiredKeys = [
    ...BASE_REQUIRED_EVIDENCE_KEYS,
    ...(options.continuityRequired ? (["continuityMatch"] as const) : []),
  ];
  const evaluatedCount = expectedKeys.filter(
    (key) => evidence[key].status === "ok",
  ).length;
  return qualityCoverageSchema.parse({
    evidenceCoverage: evaluatedCount / expectedKeys.length,
    requiredEvidenceComplete: requiredKeys.every(
      (key) => evidence[key].status === "ok",
    ),
    evaluatedCount,
    totalExpectedCount: expectedKeys.length,
  });
}

export function toQualityScore(score01: number) {
  const score = z.number().min(0).max(1).parse(score01);
  return Math.round(score * 10_000) / 100;
}
