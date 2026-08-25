import { z } from "zod";

export const cloudGenerationKindSchema = z.enum(["image", "text"]);
export type CloudGenerationKind = z.infer<typeof cloudGenerationKindSchema>;

export const cloudGenerationJobTypeSchema = z.enum([
  "background",
  "prop",
  "effect",
  "character_base",
  "story",
  "storyboard",
  "speech_bubble",
]);
export const cloudImageRevisionPresetSchema = z.enum([
  "face",
  "hands",
  "expression",
  "costume",
  "background",
  "polish",
]);
export type CloudImageRevisionPreset = z.infer<
  typeof cloudImageRevisionPresetSchema
>;
export type CloudGenerationJobType = z.infer<
  typeof cloudGenerationJobTypeSchema
>;

export const cloudModerationReasonSchema = z.enum([
  "adult_content",
  "minor_risk",
  "real_person",
  "non_consensual",
  "illegal_content",
  "ambiguous_classification",
]);
export type CloudModerationReason = z.infer<typeof cloudModerationReasonSchema>;

export const cloudModerationResultSchema = z.object({
  decision: z.enum(["allow", "review", "block"]),
  reasons: z.array(cloudModerationReasonSchema).max(10),
  policyVersion: z.literal(1),
});
export type CloudModerationResult = z.infer<typeof cloudModerationResultSchema>;

export const cloudGenerationInputSchema = z
  .object({
    kind: cloudGenerationKindSchema,
    jobType: cloudGenerationJobTypeSchema,
    prompt: z.string().trim().min(1).max(20_000),
    negativePrompt: z.string().max(10_000).default(""),
    width: z.number().int().min(256).max(4096).optional(),
    height: z.number().int().min(256).max(4096).optional(),
    seed: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    targetPanelId: z.string().uuid().optional(),
    sourcePageRevision: z.number().int().nonnegative().optional(),
    candidateCount: z.number().int().min(1).max(4).optional(),
    autoAdopt: z.boolean().optional(),
    characterProfileVersions: z
      .array(
        z.object({
          profileId: z.string().uuid(),
          version: z.number().int().positive(),
        }),
      )
      .max(12)
      .optional(),
    styleBibleVersion: z
      .object({
        bibleId: z.string().uuid(),
        version: z.number().int().positive(),
      })
      .optional(),
    worldProfileVersions: z
      .array(
        z.object({
          profileId: z.string().uuid(),
          version: z.number().int().positive(),
          kind: z.enum(["location", "prop"]),
        }),
      )
      .max(12)
      .optional(),
    referenceAssetIds: z.array(z.string().uuid()).max(8).optional(),
    referenceBundleVersion: z.literal(1).optional(),
    referenceResolverVersion: z.literal("character-reference-v1").optional(),
    resolvedCharacterReferences: z.array(z.object({
      profileId: z.string().uuid(),
      profileVersion: z.number().int().positive(),
      assetId: z.string().uuid(),
      role: z.enum(["front", "side", "back", "face", "full_body", "expression", "costume_detail"]),
    })).max(12).optional(),
    referenceReadiness: z.object({
      policy: z.enum(["warn", "block"]),
      warnings: z.array(z.object({
        code: z.literal("major_character_identity_reference_missing"),
        profileId: z.string().uuid(),
      })).max(12),
    }).optional(),
    panelContinuityStates: z.array(z.object({
      subjectKind:z.enum(["character","location","prop"]),subjectId:z.string().uuid(),
      timeOfDay:z.string().max(80),weather:z.string().max(80),stateNote:z.string().max(500),
      holdingHand:z.enum(["unspecified","left","right","both","none"]),screenSide:z.enum(["unspecified","left","center","right"]),
      gazeDirection:z.string().max(120),continuesFromPanelId:z.string().uuid().nullable(),
    })).max(12).optional(),
    operation: z
      .enum(["text_to_image", "image_to_image", "inpainting", "outpainting"])
      .optional(),
    sourceAssetId: z.string().uuid().optional(),
    maskAssetId: z.string().uuid().optional(),
    outpaintingDirection: z
      .enum(["left", "right", "top", "bottom", "all"])
      .optional(),
    revisionPreset: cloudImageRevisionPresetSchema.optional(),
    revisionInstruction: z.string().trim().max(1000).optional(),
    outputAlphaMode: z
      .enum(["preserve", "remove_white"])
      .default("preserve"),
  })
  .superRefine((value, context) => {
    const imageTypes: CloudGenerationJobType[] = [
      "background",
      "prop",
      "effect",
      "character_base",
    ];
    if (value.kind === "image" && !imageTypes.includes(value.jobType))
      context.addIssue({
        code: "custom",
        path: ["jobType"],
        message: "画像生成で利用できないJob種別です。",
      });
    if (value.kind === "text" && imageTypes.includes(value.jobType))
      context.addIssue({
        code: "custom",
        path: ["jobType"],
        message: "文章生成で利用できないJob種別です。",
      });
    if (
      value.autoAdopt &&
      (value.kind !== "image" ||
        !value.targetPanelId ||
        value.sourcePageRevision == null ||
        value.candidateCount !== 1)
    )
      context.addIssue({
        code: "custom",
        path: ["autoAdopt"],
        message: "自動採用には対象コマ、生成開始revision、1候補指定が必要です。",
      });
    if (
      (value.operation === "image_to_image" ||
        value.operation === "inpainting" ||
        value.operation === "outpainting") &&
      !value.sourceAssetId
    )
      context.addIssue({
        code: "custom",
        path: ["sourceAssetId"],
        message: "修正元画像を指定してください。",
      });
    if (
      value.sourceAssetId &&
      (!value.referenceAssetIds?.includes(value.sourceAssetId) ||
        value.kind !== "image")
    )
      context.addIssue({
        code: "custom",
        path: ["sourceAssetId"],
        message: "修正元画像を参照画像として指定してください。",
      });
    if (value.operation === "inpainting" && !value.maskAssetId)
      context.addIssue({
        code: "custom",
        path: ["maskAssetId"],
        message: "修正範囲のマスク画像を指定してください。",
      });
    if (value.operation !== "inpainting" && value.maskAssetId)
      context.addIssue({
        code: "custom",
        path: ["maskAssetId"],
        message: "マスク画像は部分修正でのみ指定できます。",
      });
    if (value.operation === "outpainting" && !value.outpaintingDirection)
      context.addIssue({
        code: "custom",
        path: ["outpaintingDirection"],
        message: "画像を拡張する方向を指定してください。",
      });
    if (value.operation !== "outpainting" && value.outpaintingDirection)
      context.addIssue({
        code: "custom",
        path: ["outpaintingDirection"],
        message: "拡張方向は画角拡張でのみ指定できます。",
      });
  });
export type CloudGenerationInput = z.output<typeof cloudGenerationInputSchema>;

const BLOCK_PATTERNS: Array<[CloudModerationReason, RegExp]> = [
  [
    "adult_content",
    /(?:nsfw|explicit|porn|sexual|nudity|裸体|全裸|性交|性行為|成人向け|アダルト)/iu,
  ],
  [
    "minor_risk",
    /(?:child|minor|underage|schoolgirl|schoolboy|児童|未成年|小学生|中学生|幼女|ショタ)/iu,
  ],
  [
    "non_consensual",
    /(?:rape|non[- ]?consensual|sexual assault|強姦|レイプ|不同意|性的暴行)/iu,
  ],
  ["illegal_content", /(?:bestiality|獣姦|児童ポルノ)/iu],
];

const REVIEW_PATTERNS: Array<[CloudModerationReason, RegExp]> = [
  [
    "real_person",
    /(?:celebrity|politician|real person|実在人物|芸能人|政治家|本人そっくり)/iu,
  ],
  [
    "ambiguous_classification",
    /(?:sexy|sensual|fetish|セクシー|官能|フェチ|際どい)/iu,
  ],
];

export function moderateGeneralCloudPrompt(
  prompt: string,
): CloudModerationResult {
  const normalized = prompt.normalize("NFKC");
  const blocked = BLOCK_PATTERNS.filter(([, pattern]) =>
    pattern.test(normalized),
  ).map(([reason]) => reason);
  if (blocked.length)
    return {
      decision: "block",
      reasons: [...new Set(blocked)],
      policyVersion: 1,
    };
  const review = REVIEW_PATTERNS.filter(([, pattern]) =>
    pattern.test(normalized),
  ).map(([reason]) => reason);
  if (review.length)
    return {
      decision: "review",
      reasons: [...new Set(review)],
      policyVersion: 1,
    };
  return { decision: "allow", reasons: [], policyVersion: 1 };
}

export const cloudProviderCapabilitySchema = z.object({
  providerId: z.string().trim().min(1).max(100),
  modelId: z.string().trim().min(1).max(200),
  kind: cloudGenerationKindSchema,
  jobTypes: z.array(cloudGenerationJobTypeSchema).min(1),
  operations: z
    .array(
      z.enum(["text_to_image", "image_to_image", "inpainting", "outpainting"]),
    )
    .min(1)
    .optional(),
  policyVersion: z.string().trim().min(1).max(100),
  pricingVersion: z.string().trim().min(1).max(100),
  enabled: z.boolean(),
});
export type CloudProviderCapability = z.infer<
  typeof cloudProviderCapabilitySchema
>;

export type CloudGenerationContext = {
  jobId: string;
  projectId: string;
  pageId?: string;
  idempotencyKey: string;
  providerJobId?: string;
  checkpointProviderJobId?: (providerJobId: string) => Promise<void>;
  referenceImageUrls?: string[];
  maskImageUrl?: string;
};

export type CloudGenerationUsage = {
  inputUnits?: number;
  outputUnits?: number;
  actualCostMicros?: number;
};

export type CloudImageGenerationResult = {
  providerJobId?: string;
  images: Array<{ bytes: Uint8Array; mimeType: string; fileName: string }>;
  usage: CloudGenerationUsage;
  providerModeration?: CloudModerationResult;
};

export type CloudGenerationCostEstimate = {
  estimatedCostMicros: number;
  pricingVersion: string;
};

export interface CloudImageGenerationProvider {
  readonly capability: CloudProviderCapability & { kind: "image" };
  capabilities?(): CloudProviderCapability & { kind: "image" };
  generate(
    input: CloudGenerationInput & { kind: "image" },
    context: CloudGenerationContext,
    signal?: AbortSignal,
  ): Promise<CloudImageGenerationResult>;
  generatePanel?(
    input: CloudGenerationInput & { kind: "image" },
    context: CloudGenerationContext,
    signal?: AbortSignal,
  ): Promise<CloudImageGenerationResult>;
  editRegion?(
    input: CloudGenerationInput & { kind: "image"; operation: "inpainting" | "outpainting" },
    context: CloudGenerationContext,
    signal?: AbortSignal,
  ): Promise<CloudImageGenerationResult>;
  estimateCost?(input: CloudGenerationInput & { kind: "image" }): Promise<CloudGenerationCostEstimate>;
  cancelProviderJob?(providerJobId: string): Promise<void>;
  cancel?(providerJobId: string): Promise<void>;
}

export interface CloudTextGenerationProvider {
  readonly capability: CloudProviderCapability & { kind: "text" };
  generate(
    input: CloudGenerationInput & { kind: "text" },
    context: CloudGenerationContext,
    signal?: AbortSignal,
  ): Promise<{
    providerJobId?: string;
    text: string;
    usage: CloudGenerationUsage;
    providerModeration?: CloudModerationResult;
  }>;
  cancel?(providerJobId: string): Promise<void>;
}

export function shouldRetryCloudGeneration(input: {
  attempt: number;
  maxAttempts: number;
  errorCode: string;
}) {
  if (input.attempt >= input.maxAttempts) return false;
  return ["timeout", "rate_limited", "provider_5xx", "network_error"].includes(
    input.errorCode,
  );
}
