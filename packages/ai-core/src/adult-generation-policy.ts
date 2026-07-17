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

export const adultGenerationAdministratorInputSchema = z.object({
  enabled: z.boolean(),
});

export const adultGenerationContentConfirmationSchema = z.object({
  fictionalAdultsOnly: z.literal(true),
  allCharacters18Plus: z.literal(true),
  noMinorOrAgeAmbiguousAppearance: z.literal(true),
  noRealPersonReference: z.literal(true),
  consensualAndNonExploitativeOnly: z.literal(true),
  rightsConfirmed: z.literal(true),
});
export type AdultGenerationContentConfirmation = z.infer<
  typeof adultGenerationContentConfirmationSchema
>;

export const adultPromptBlockReasonSchema = z.enum([
  "minor_or_age_ambiguous",
  "real_person_reference",
  "nonconsensual_or_exploitative_content",
]);
export type AdultPromptBlockReason = z.infer<
  typeof adultPromptBlockReasonSchema
>;

const adultPromptRules: Array<{
  reason: AdultPromptBlockReason;
  patterns: RegExp[];
}> = [
  {
    reason: "minor_or_age_ambiguous",
    patterns: [
      /(?:^|\W)(?:child|minor|underage|loli|lolita|schoolgirl|schoolboy|teen)(?:$|\W)/iu,
      /(?:^|\W)(?:[0-9]|1[0-7])\s*(?:years?\s*old|y\/o|yo)(?:$|\W)/iu,
      /(?:^|\D)(?:[0-9]|1[0-7])\s*歳/u,
      /未成年|児童|幼児|幼女|幼い外見|年齢不詳|ロリ|小学生|中学生|高校生/u,
    ],
  },
  {
    reason: "real_person_reference",
    patterns: [
      /(?:^|\W)(?:deepfake|face\s*swap|celebrity|real\s+person|actual\s+person)(?:$|\W)/iu,
      /実在人物|実在の人物|芸能人|著名人|ディープフェイク|顔交換/u,
    ],
  },
  {
    reason: "nonconsensual_or_exploitative_content",
    patterns: [
      /(?:^|\W)(?:rape|raped|non[- ]?consensual|forced\s+sex|sexual\s+slavery|unconscious\s+sex)(?:$|\W)/iu,
      /強姦|レイプ|非同意|無理やり|性的搾取|性的奴隷|意識不明.*性行為/u,
    ],
  },
];

export function reviewAdultGenerationPrompt(prompt: string):
  | { allowed: true; reason: null }
  | { allowed: false; reason: AdultPromptBlockReason } {
  const normalized = prompt.normalize("NFKC");
  for (const rule of adultPromptRules)
    if (rule.patterns.some((pattern) => pattern.test(normalized)))
      return { allowed: false, reason: rule.reason };
  return { allowed: true, reason: null };
}

export const adultProviderApprovalInputSchema = z
  .object({
    providerId: z.literal("dezgo"),
    status: z.enum(["unverified", "approved", "revoked"]),
    evidenceSha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
    confirmedAt: z.string().datetime().nullable(),
    expiresAt: z.string().datetime().nullable(),
    revokedAt: z.string().datetime().nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.status === "approved" &&
      (!value.evidenceSha256 || !value.confirmedAt)
    )
      context.addIssue({
        code: "custom",
        message: "Provider承認には証跡SHA-256と確認日時が必要です。",
      });
    if (
      value.confirmedAt &&
      value.expiresAt &&
      Date.parse(value.expiresAt) <= Date.parse(value.confirmedAt)
    )
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Provider承認の有効期限が確認日時以前です。",
      });
  });
export type AdultProviderApprovalInput = z.input<
  typeof adultProviderApprovalInputSchema
>;

export const adultProviderApprovalSchema = z.object({
  providerId: z.literal("dezgo"),
  status: z.enum(["unverified", "approved", "revoked"]),
  evidenceSha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  confirmedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
});
export type AdultProviderApproval = z.infer<
  typeof adultProviderApprovalSchema
>;

export const adultModelApprovalInputSchema = z
  .object({
    providerId: z.literal("dezgo"),
    modelId: z.string().trim().min(1).max(300),
    status: z.enum(["approved", "revoked"]),
    licenseEvidenceSha256: z.string().regex(/^[0-9a-f]{64}$/),
    verifiedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.expiresAt &&
      Date.parse(value.expiresAt) <= Date.parse(value.verifiedAt)
    )
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "モデル承認の有効期限が確認日時以前です。",
      });
  });
export type AdultModelApprovalInput = z.input<
  typeof adultModelApprovalInputSchema
>;

export const adultModelApprovalSchema = adultModelApprovalInputSchema
  .safeExtend({ updatedAt: z.string().datetime() });
export type AdultModelApproval = z.infer<typeof adultModelApprovalSchema>;

export type AdultProviderCapabilityResult =
  | { allowed: true; reason: null }
  | {
      allowed: false;
      reason:
        | "provider_unverified"
        | "provider_revoked"
        | "provider_expired"
        | "model_not_allowlisted"
        | "model_revoked"
        | "model_approval_expired";
    };

export function evaluateAdultProviderCapability(input: {
  approval: AdultProviderApproval;
  model: AdultModelApproval | null;
  referenceTime?: string;
}): AdultProviderCapabilityResult {
  const referenceMs = Date.parse(input.referenceTime ?? new Date().toISOString());
  if (!Number.isFinite(referenceMs))
    throw new Error("Provider承認の基準日時が不正です。");
  if (input.approval.status === "revoked")
    return { allowed: false, reason: "provider_revoked" };
  if (
    input.approval.status !== "approved" ||
    !input.approval.evidenceSha256 ||
    !input.approval.confirmedAt
  )
    return { allowed: false, reason: "provider_unverified" };
  if (
    input.approval.expiresAt &&
    Date.parse(input.approval.expiresAt) <= referenceMs
  )
    return { allowed: false, reason: "provider_expired" };
  if (!input.model)
    return { allowed: false, reason: "model_not_allowlisted" };
  if (input.model.status === "revoked")
    return { allowed: false, reason: "model_revoked" };
  if (input.model.expiresAt && Date.parse(input.model.expiresAt) <= referenceMs)
    return { allowed: false, reason: "model_approval_expired" };
  return { allowed: true, reason: null };
}

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
