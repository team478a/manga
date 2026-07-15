import { z } from "zod";

export const hybridGenerationJobTypeSchema = z.enum([
  "story",
  "storyboard",
  "panel_layout",
  "character_base",
  "character_variation",
  "character_expression",
  "character_pose",
  "adult_character_render",
  "background",
  "background_variation",
  "prop",
  "effect",
  "inpaint",
  "face_fix",
  "hand_fix",
  "upscale",
  "tone",
  "speech_bubble",
  "text_layout",
  "page_composite",
  "export",
]);
export type HybridGenerationJobType = z.infer<
  typeof hybridGenerationJobTypeSchema
>;

export const safeAssetJobTypeSchema = z.enum(["background", "prop", "effect"]);
export type SafeAssetJobType = z.infer<typeof safeAssetJobTypeSchema>;

export const safeAssetLibraryRequestSchema = z.object({
  projectId: z.string().uuid(),
  pageId: z.string().uuid().optional(),
  type: safeAssetJobTypeSchema,
  query: z.string().trim().min(1).max(500),
});
export type SafeAssetLibraryRequest = z.infer<
  typeof safeAssetLibraryRequestSchema
>;

export const executionTargetSchema = z.enum([
  "builtin",
  "local",
  "cloud",
  "render_node",
  "asset_library",
]);
export type ExecutionTarget = z.infer<typeof executionTargetSchema>;

export const sensitivityLevelSchema = z.enum([
  "safe",
  "restricted",
  "adult",
  "external_forbidden",
]);
export type SensitivityLevel = z.infer<typeof sensitivityLevelSchema>;

export const externalProcessingPolicySchema = z.enum([
  "local_only",
  "safe_assets_only",
  "background_only",
  "manual_approval",
  "custom",
]);
export type ExternalProcessingPolicy = z.infer<
  typeof externalProcessingPolicySchema
>;

export const personPresenceSchema = z.enum(["none", "present", "unknown"]);
export type PersonPresence = z.infer<typeof personPresenceSchema>;

export const generationJobDraftSchema = z.object({
  projectId: z.string().uuid(),
  pageId: z.string().uuid().optional(),
  panelId: z.string().uuid().optional(),
  type: hybridGenerationJobTypeSchema,
  sensitivity: sensitivityLevelSchema.default("external_forbidden"),
  requestedTarget: executionTargetSchema.optional(),
  inputAssetIds: z.array(z.string().uuid()).default([]),
  personPresence: personPresenceSchema.default("unknown"),
  hasCharacterReference: z.boolean().default(false),
  hasCompletedPage: z.boolean().default(false),
  promptIncludesRestrictedContent: z.boolean().default(false),
  allInputAssetsExternalAllowed: z.boolean().default(false),
});
export type GenerationJobDraft = z.output<typeof generationJobDraftSchema>;
export type GenerationJobDraftInput = z.input<typeof generationJobDraftSchema>;

export const routingContextSchema = z.object({
  policy: externalProcessingPolicySchema,
  availableTargets: z.array(executionTargetSchema),
  preferLocal: z.boolean().default(true),
  externalProviderEnabled: z.boolean().default(false),
  externalCostWithinLimit: z.boolean().default(false),
  requireExternalConfirmation: z.boolean().default(true),
  manualApprovalGranted: z.boolean().default(false),
  customCloudJobTypes: z.array(hybridGenerationJobTypeSchema).default([]),
  sensitiveRenderNodeAllowed: z.boolean().default(false),
  cloudProviderId: z.string().trim().min(1).max(200).optional(),
  renderNodeProviderId: z.string().trim().min(1).max(200).optional(),
});
export type RoutingContext = z.output<typeof routingContextSchema>;
export type RoutingContextInput = z.input<typeof routingContextSchema>;

export const projectGenerationPolicyInputSchema = z.object({
  projectId: z.string().uuid(),
  externalProcessingPolicy:
    externalProcessingPolicySchema.default("safe_assets_only"),
  preferLocal: z.boolean().default(true),
  externalConfirmationRequired: z.boolean().default(true),
  monthlyCostLimit: z
    .number()
    .finite()
    .min(0)
    .max(1_000_000_000)
    .nullable()
    .default(null),
  customCloudJobTypes: z
    .array(hybridGenerationJobTypeSchema)
    .max(50)
    .default([]),
});
export type ProjectGenerationPolicyInput = z.input<
  typeof projectGenerationPolicyInputSchema
>;

export const projectGenerationPolicySchema =
  projectGenerationPolicyInputSchema.extend({
    updatedAt: z.string().datetime(),
  });
export type ProjectGenerationPolicy = z.output<
  typeof projectGenerationPolicySchema
>;

export const routeReasonSchema = z.enum([
  "builtin_operation",
  "explicit_target",
  "sensitive_local_only",
  "sensitive_render_node",
  "project_local_only",
  "asset_library_preferred",
  "external_background_allowed",
  "external_safe_asset_allowed",
  "external_manual_approval",
  "external_custom_policy",
  "local_fallback",
  "required_target_unavailable",
]);
export type RouteReason = z.infer<typeof routeReasonSchema>;

export const routeDecisionSchema = z.object({
  target: executionTargetSchema,
  providerId: z.string().trim().min(1).max(200).optional(),
  reason: routeReasonSchema,
  requiresUserConfirmation: z.boolean(),
  blocked: z.boolean(),
});
export type RouteDecision = z.infer<typeof routeDecisionSchema>;

export const generationRouteDecisionRecordSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  projectId: z.string().uuid(),
  draft: generationJobDraftSchema,
  context: routingContextSchema,
  decision: routeDecisionSchema,
  promptSha256: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string().datetime(),
});
export type GenerationRouteDecisionRecord = z.infer<
  typeof generationRouteDecisionRecordSchema
>;

const builtinTypes = new Set<HybridGenerationJobType>([
  "panel_layout",
  "tone",
  "speech_bubble",
  "text_layout",
  "page_composite",
  "export",
]);

const localOnlyTypes = new Set<HybridGenerationJobType>([
  "story",
  "storyboard",
  "character_base",
  "character_variation",
  "character_expression",
  "character_pose",
  "adult_character_render",
  "inpaint",
  "face_fix",
  "hand_fix",
]);

const reusableAssetTypes = new Set<HybridGenerationJobType>([
  "background",
  "background_variation",
  "prop",
  "effect",
]);

const backgroundTypes = new Set<HybridGenerationJobType>([
  "background",
  "background_variation",
]);

function decision(
  target: ExecutionTarget,
  reason: RouteReason,
  options: Partial<Omit<RouteDecision, "target" | "reason">> = {},
): RouteDecision {
  return {
    target,
    reason,
    requiresUserConfirmation: false,
    blocked: false,
    ...options,
  };
}

function targetAvailable(context: RoutingContext, target: ExecutionTarget) {
  return context.availableTargets.includes(target);
}

function localRequired(job: GenerationJobDraft) {
  return (
    localOnlyTypes.has(job.type) ||
    job.sensitivity !== "safe" ||
    job.personPresence !== "none" ||
    job.hasCharacterReference ||
    job.hasCompletedPage ||
    job.promptIncludesRestrictedContent ||
    (job.inputAssetIds.length > 0 && !job.allInputAssetsExternalAllowed)
  );
}

function localOrBlocked(
  context: RoutingContext,
  reason: RouteReason,
): RouteDecision {
  if (targetAvailable(context, "local")) return decision("local", reason);
  if (
    context.sensitiveRenderNodeAllowed &&
    targetAvailable(context, "render_node")
  )
    return decision("render_node", "sensitive_render_node", {
      providerId: context.renderNodeProviderId,
      requiresUserConfirmation: true,
    });
  return decision("local", "required_target_unavailable", { blocked: true });
}

function cloudAllowed(job: GenerationJobDraft, context: RoutingContext) {
  if (!reusableAssetTypes.has(job.type)) return false;
  if (context.policy === "safe_assets_only") return true;
  if (context.policy === "background_only")
    return backgroundTypes.has(job.type);
  if (context.policy === "manual_approval") return true;
  if (context.policy === "custom")
    return context.customCloudJobTypes.includes(job.type);
  return false;
}

function cloudReason(context: RoutingContext): RouteReason {
  if (context.policy === "background_only")
    return "external_background_allowed";
  if (context.policy === "manual_approval") return "external_manual_approval";
  if (context.policy === "custom") return "external_custom_policy";
  return "external_safe_asset_allowed";
}

/**
 * Selects an execution target without network, filesystem, or database access.
 * Missing classification data is parsed to external-forbidden defaults, so an
 * incomplete draft cannot be routed to a cloud provider.
 */
export function routeGenerationJob(
  draftInput: GenerationJobDraftInput,
  contextInput: RoutingContextInput,
): RouteDecision {
  const job = generationJobDraftSchema.parse(draftInput);
  const context = routingContextSchema.parse(contextInput);

  if (builtinTypes.has(job.type)) {
    if (targetAvailable(context, "builtin"))
      return decision("builtin", "builtin_operation");
    return decision("builtin", "required_target_unavailable", {
      blocked: true,
    });
  }

  if (localRequired(job))
    return localOrBlocked(context, "sensitive_local_only");

  if (context.policy === "local_only")
    return localOrBlocked(context, "project_local_only");

  if (job.requestedTarget === "local")
    return targetAvailable(context, "local")
      ? decision("local", "explicit_target")
      : decision("local", "required_target_unavailable", { blocked: true });

  if (
    job.requestedTarget === "render_node" &&
    targetAvailable(context, "render_node")
  )
    return decision("render_node", "explicit_target", {
      providerId: context.renderNodeProviderId,
      requiresUserConfirmation: true,
    });

  if (
    job.requestedTarget === "asset_library" &&
    reusableAssetTypes.has(job.type) &&
    targetAvailable(context, "asset_library")
  )
    return decision("asset_library", "explicit_target");

  const canUseCloud =
    cloudAllowed(job, context) &&
    context.externalProviderEnabled &&
    context.externalCostWithinLimit &&
    targetAvailable(context, "cloud");
  if (job.requestedTarget === "cloud" && canUseCloud)
    return decision("cloud", "explicit_target", {
      providerId: context.cloudProviderId,
      requiresUserConfirmation:
        context.requireExternalConfirmation ||
        (context.policy === "manual_approval" &&
          !context.manualApprovalGranted),
    });

  if (
    reusableAssetTypes.has(job.type) &&
    targetAvailable(context, "asset_library")
  )
    return decision("asset_library", "asset_library_preferred");

  if (context.preferLocal && targetAvailable(context, "local"))
    return decision("local", "local_fallback");

  if (canUseCloud)
    return decision("cloud", cloudReason(context), {
      providerId: context.cloudProviderId,
      requiresUserConfirmation:
        context.requireExternalConfirmation ||
        (context.policy === "manual_approval" &&
          !context.manualApprovalGranted),
    });

  if (job.type === "upscale" && targetAvailable(context, "render_node"))
    return decision("render_node", "local_fallback", {
      providerId: context.renderNodeProviderId,
    });

  return localOrBlocked(context, "local_fallback");
}
