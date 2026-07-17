import { z } from "zod";
import {
  externalProcessingPolicySchema,
  safeAssetJobTypeSchema,
  safeAssetLibraryRequestSchema,
  type ExternalProcessingPolicy,
  type SafeAssetLibraryRequest,
} from "./hybrid-generation.js";

export const externalAssetProviderDescriptorSchema = z.object({
  providerId: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(200),
  enabled: z.boolean(),
  endpointConfigured: z.boolean(),
  supportedJobTypes: z.array(safeAssetJobTypeSchema).max(3),
  dataRetentionSummary: z.string().trim().max(1000),
  trainingUseSummary: z.string().trim().max(1000),
  pricingSummary: z.string().trim().max(1000),
});
export type ExternalAssetProviderDescriptor = z.infer<
  typeof externalAssetProviderDescriptorSchema
>;

export const externalPayloadManifestSchema = z.object({
  jobType: safeAssetJobTypeSchema,
  sensitivity: z.literal("safe"),
  promptIncluded: z.literal(true),
  negativePromptIncluded: z.literal(false),
  inputAssetCount: z.literal(0),
  characterReferenceIncluded: z.literal(false),
  completedPageIncluded: z.literal(false),
  personPresence: z.literal("none"),
});
export type ExternalPayloadManifest = z.infer<
  typeof externalPayloadManifestSchema
>;

export const externalDispatchBlockReasonSchema = z.enum([
  "provider_not_configured",
  "provider_disabled",
  "unsupported_job_type",
  "policy_blocked",
  "pricing_stale",
  "cost_limit_not_set",
  "cost_limit_exceeded",
  "balance_unavailable",
  "balance_insufficient",
  "cost_estimate_unavailable",
]);
export type ExternalDispatchBlockReason = z.infer<
  typeof externalDispatchBlockReasonSchema
>;
export type ExternalDispatchCostBlockReason =
  | "pricing_stale"
  | "cost_limit_not_set"
  | "cost_limit_exceeded"
  | "balance_unavailable"
  | "balance_insufficient";

export const externalDispatchPreviewSchema = z.object({
  previewId: z.string().uuid(),
  projectId: z.string().uuid(),
  pageId: z.string().uuid().optional(),
  jobType: safeAssetJobTypeSchema,
  promptSha256: z.string().regex(/^[0-9a-f]{64}$/),
  provider: externalAssetProviderDescriptorSchema,
  manifest: externalPayloadManifestSchema,
  estimatedCost: z.number().finite().nonnegative().nullable(),
  currency: z.string().trim().length(3).nullable(),
  requiresUserConfirmation: z.literal(true),
  executable: z.boolean(),
  blockReason: externalDispatchBlockReasonSchema.nullable(),
  createdAt: z.string().datetime(),
});
export type ExternalDispatchPreview = z.infer<
  typeof externalDispatchPreviewSchema
>;

export const externalDispatchConfirmationSchema = z.object({
  previewId: z.string().uuid(),
  promptSha256: z.string().regex(/^[0-9a-f]{64}$/),
  payloadReviewed: z.literal(true),
  costReviewed: z.literal(true),
  providerTermsReviewed: z.literal(true),
  confirmedAt: z.string().datetime(),
});
export type ExternalDispatchConfirmation = z.infer<
  typeof externalDispatchConfirmationSchema
>;

export const unconfiguredExternalAssetProvider =
  externalAssetProviderDescriptorSchema.parse({
    providerId: "unconfigured",
    displayName: "External safe asset provider",
    enabled: false,
    endpointConfigured: false,
    supportedJobTypes: [],
    dataRetentionSummary: "未設定",
    trainingUseSummary: "未設定",
    pricingSummary: "未設定",
  });

export interface ExternalAssetProvider {
  readonly descriptor: ExternalAssetProviderDescriptor;
  estimate(
    request: SafeAssetLibraryRequest,
    signal?: AbortSignal,
  ): Promise<{ cost: number; currency: string }>;
  submit(
    request: SafeAssetLibraryRequest,
    confirmation: ExternalDispatchConfirmation,
    signal?: AbortSignal,
  ): Promise<{ providerJobId: string }>;
}

function policyAllows(
  policy: ExternalProcessingPolicy,
  jobType: SafeAssetLibraryRequest["type"],
  customCloudJobTypes: string[],
) {
  if (policy === "local_only") return false;
  if (policy === "background_only") return jobType === "background";
  if (policy === "custom") return customCloudJobTypes.includes(jobType);
  return true;
}

export function createExternalDispatchPreview(input: {
  previewId: string;
  request: SafeAssetLibraryRequest;
  promptSha256: string;
  policy: ExternalProcessingPolicy;
  customCloudJobTypes?: string[];
  provider?: ExternalAssetProviderDescriptor;
  estimate?: { cost: number; currency: string };
  costBlockReason?: ExternalDispatchCostBlockReason;
  createdAt: string;
}): ExternalDispatchPreview {
  const request = safeAssetLibraryRequestSchema.parse(input.request);
  const policy = externalProcessingPolicySchema.parse(input.policy);
  const provider = externalAssetProviderDescriptorSchema.parse(
    input.provider ?? unconfiguredExternalAssetProvider,
  );
  const supported = provider.supportedJobTypes.includes(request.type);
  const allowed = policyAllows(
    policy,
    request.type,
    input.customCloudJobTypes ?? [],
  );
  let blockReason: ExternalDispatchBlockReason | null = null;
  if (!provider.endpointConfigured) blockReason = "provider_not_configured";
  else if (!provider.enabled) blockReason = "provider_disabled";
  else if (!supported) blockReason = "unsupported_job_type";
  else if (!allowed) blockReason = "policy_blocked";
  else if (input.costBlockReason) blockReason = input.costBlockReason;
  else if (!input.estimate) blockReason = "cost_estimate_unavailable";
  return externalDispatchPreviewSchema.parse({
    previewId: input.previewId,
    projectId: request.projectId,
    pageId: request.pageId,
    jobType: request.type,
    promptSha256: input.promptSha256,
    provider,
    manifest: {
      jobType: request.type,
      sensitivity: "safe",
      promptIncluded: true,
      negativePromptIncluded: false,
      inputAssetCount: 0,
      characterReferenceIncluded: false,
      completedPageIncluded: false,
      personPresence: "none",
    },
    estimatedCost: input.estimate?.cost ?? null,
    currency: input.estimate?.currency.toUpperCase() ?? null,
    requiresUserConfirmation: true,
    executable: blockReason === null,
    blockReason,
    createdAt: input.createdAt,
  });
}
