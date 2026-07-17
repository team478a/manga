import { z } from "zod";

export const ADULT_GENERATION_TERMS_VERSION =
  "adult-generation-v1-2026-07-17";
export const ADULT_GENERATION_CONSENT_VALIDITY_DAYS = 30;

export const adultGenerationConsentStatusSchema = z.enum([
  "missing",
  "active",
  "expired",
  "revoked",
  "terms_changed",
]);
export type AdultGenerationConsentStatus = z.infer<
  typeof adultGenerationConsentStatusSchema
>;

export const adultGenerationSettingsSchema = z.object({
  administratorEnabled: z.boolean(),
  userConfirmed18Plus: z.boolean(),
  consentStatus: adultGenerationConsentStatusSchema,
  termsVersion: z.string().nullable(),
  confirmedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
});
export type AdultGenerationSettings = z.infer<
  typeof adultGenerationSettingsSchema
>;

export const adultGenerationConsentInputSchema = z.object({
  userConfirmed18Plus: z.literal(true),
  termsVersion: z.literal(ADULT_GENERATION_TERMS_VERSION),
});
export type AdultGenerationConsentInput = z.input<
  typeof adultGenerationConsentInputSchema
>;

export const adultGenerationGateInputSchema = z.object({
  userConfirmed18Plus: z.boolean().default(false),
  projectAgeRating: z
    .enum(["全年齢", "12歳以上", "15歳以上", "成人向け"])
    .default("全年齢"),
  jobType: z.string().trim().max(100).default(""),
  characterIsFictional: z.boolean().default(false),
  allDepictedCharactersExplicitly18Plus: z.boolean().default(false),
  minorOrAgeAmbiguousAppearanceDetected: z.boolean().default(true),
  realPersonReferenceIncluded: z.boolean().default(true),
  nonConsensualOrExploitativeContentDetected: z.boolean().default(true),
  rightsConfirmed: z.boolean().default(false),
  localPolicyReviewPassed: z.boolean().default(false),
  externalTransmissionReviewed: z.boolean().default(false),
  administratorAdultGenerationEnabled: z.boolean().default(false),
  providerAdultCommercialUseApproval: z
    .enum(["unverified", "approved", "revoked"])
    .default("unverified"),
  providerApprovalReferenceSha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  selectedModelAdultUseApproved: z.boolean().default(false),
  adultGenerationFeatureEnabled: z.boolean().default(false),
});
export type AdultGenerationGateInput = z.input<
  typeof adultGenerationGateInputSchema
>;

export const adultGenerationBlockReasonSchema = z.enum([
  "user_age_not_confirmed",
  "administrator_disabled",
  "provider_approval_missing",
  "feature_disabled",
  "project_not_adult",
  "job_type_not_adult",
  "fictional_character_not_confirmed",
  "depicted_adult_age_not_confirmed",
  "minor_or_age_ambiguous",
  "real_person_reference",
  "nonconsensual_or_exploitative_content",
  "rights_not_confirmed",
  "local_policy_review_required",
  "model_not_approved_for_adult_use",
  "external_transmission_not_reviewed",
]);
export type AdultGenerationBlockReason = z.infer<
  typeof adultGenerationBlockReasonSchema
>;

export type AdultGenerationGateResult =
  | { allowed: true; reason: null }
  | { allowed: false; reason: AdultGenerationBlockReason };

export function evaluateAdultGenerationGate(
  input: AdultGenerationGateInput,
): AdultGenerationGateResult {
  const value = adultGenerationGateInputSchema.parse(input);
  if (!value.userConfirmed18Plus)
    return { allowed: false, reason: "user_age_not_confirmed" };
  if (!value.administratorAdultGenerationEnabled)
    return { allowed: false, reason: "administrator_disabled" };
  if (
    value.providerAdultCommercialUseApproval !== "approved" ||
    !value.providerApprovalReferenceSha256
  )
    return { allowed: false, reason: "provider_approval_missing" };
  if (!value.adultGenerationFeatureEnabled)
    return { allowed: false, reason: "feature_disabled" };
  if (value.projectAgeRating !== "成人向け")
    return { allowed: false, reason: "project_not_adult" };
  if (value.jobType !== "adult_character_render")
    return { allowed: false, reason: "job_type_not_adult" };
  if (!value.characterIsFictional)
    return { allowed: false, reason: "fictional_character_not_confirmed" };
  if (!value.allDepictedCharactersExplicitly18Plus)
    return { allowed: false, reason: "depicted_adult_age_not_confirmed" };
  if (value.minorOrAgeAmbiguousAppearanceDetected)
    return { allowed: false, reason: "minor_or_age_ambiguous" };
  if (value.realPersonReferenceIncluded)
    return { allowed: false, reason: "real_person_reference" };
  if (value.nonConsensualOrExploitativeContentDetected)
    return {
      allowed: false,
      reason: "nonconsensual_or_exploitative_content",
    };
  if (!value.rightsConfirmed)
    return { allowed: false, reason: "rights_not_confirmed" };
  if (!value.localPolicyReviewPassed)
    return { allowed: false, reason: "local_policy_review_required" };
  if (!value.selectedModelAdultUseApproved)
    return { allowed: false, reason: "model_not_approved_for_adult_use" };
  if (!value.externalTransmissionReviewed)
    return {
      allowed: false,
      reason: "external_transmission_not_reviewed",
    };
  return { allowed: true, reason: null };
}
