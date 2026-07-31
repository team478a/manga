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
    characterProfileVersions: z
      .array(
        z.object({
          profileId: z.string().uuid(),
          version: z.number().int().positive(),
        }),
      )
      .max(12)
      .optional(),
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
};

export type CloudGenerationUsage = {
  inputUnits?: number;
  outputUnits?: number;
  actualCostMicros?: number;
};

export interface CloudImageGenerationProvider {
  readonly capability: CloudProviderCapability & { kind: "image" };
  generate(
    input: CloudGenerationInput & { kind: "image" },
    context: CloudGenerationContext,
    signal?: AbortSignal,
  ): Promise<{
    providerJobId?: string;
    images: Array<{ bytes: Uint8Array; mimeType: string; fileName: string }>;
    usage: CloudGenerationUsage;
    providerModeration?: CloudModerationResult;
  }>;
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
