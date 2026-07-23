import { z } from "zod";

export const adultReferenceImageAssessmentSchema = z
  .object({
    personPresence: z.enum(["none", "present", "unknown"]),
    ageAssessment: z.enum([
      "adult",
      "minor_or_ambiguous",
      "not_applicable",
      "unknown",
    ]),
    realPersonAssessment: z.enum([
      "not_real",
      "real_or_possible",
      "not_applicable",
      "unknown",
    ]),
    reviewMethod: z.enum(["manual_local", "local_model"]),
    reviewedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.personPresence === "none" &&
      (value.ageAssessment !== "not_applicable" ||
        value.realPersonAssessment !== "not_applicable")
    )
      context.addIssue({
        code: "custom",
        message:
          "人物なしの画像では年齢と実在人物の判定を「該当なし」にしてください。",
      });
    if (
      value.personPresence === "present" &&
      (value.ageAssessment === "not_applicable" ||
        value.realPersonAssessment === "not_applicable")
    )
      context.addIssue({
        code: "custom",
        message: "人物を含む画像では年齢と実在人物の判定が必要です。",
      });
  });
export type AdultReferenceImageAssessment = z.infer<
  typeof adultReferenceImageAssessmentSchema
>;

export const adultReferenceImageAssessmentInputSchema = z
  .object({
    projectId: z.string().uuid(),
    assetId: z.string().uuid(),
    assessment: adultReferenceImageAssessmentSchema,
  })
  .strict();
export type AdultReferenceImageAssessmentInput = z.infer<
  typeof adultReferenceImageAssessmentInputSchema
>;

export type AdultReferenceImageBlockReason =
  | "assessment_missing"
  | "local_model_review_required"
  | "person_presence_unknown"
  | "minor_or_age_ambiguous"
  | "real_person_possible";

export type AdultReferenceImageEvaluation =
  | { allowed: true; reason: null }
  | { allowed: false; reason: AdultReferenceImageBlockReason };

export function evaluateAdultReferenceImage(
  assessment: AdultReferenceImageAssessment | null | undefined,
  options: { requireLocalModel?: boolean } = {},
): AdultReferenceImageEvaluation {
  if (!assessment) return { allowed: false, reason: "assessment_missing" };
  const value = adultReferenceImageAssessmentSchema.parse(assessment);
  if (options.requireLocalModel && value.reviewMethod !== "local_model")
    return { allowed: false, reason: "local_model_review_required" };
  if (value.personPresence === "unknown")
    return { allowed: false, reason: "person_presence_unknown" };
  if (value.personPresence === "none") return { allowed: true, reason: null };
  if (value.ageAssessment !== "adult")
    return { allowed: false, reason: "minor_or_age_ambiguous" };
  if (value.realPersonAssessment !== "not_real")
    return { allowed: false, reason: "real_person_possible" };
  return { allowed: true, reason: null };
}
