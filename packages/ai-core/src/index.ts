import { z } from "zod";
import { safeAssetJobTypeSchema } from "./hybrid-generation.js";
import { adultGenerationContentConfirmationSchema } from "./adult-generation-policy.js";

export * from "./hybrid-generation.js";
export * from "./external-asset-provider.js";
export * from "./runtime-profile.js";
export * from "./adult-generation-policy.js";
export * from "./cloud-generation.js";
export * from "./cloud-billing.js";

export const generationStatusSchema = z.enum([
  "queued",
  "paused",
  "running",
  "completed",
  "failed",
  "canceled",
]);
export type GenerationStatus = z.infer<typeof generationStatusSchema>;
export const generationQueueSettingsSchema = z.object({
  nightModeEnabled: z.boolean().default(false),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("22:00"),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("07:00"),
});
export type GenerationQueueSettings = z.infer<
  typeof generationQueueSettingsSchema
>;
const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};
export function isGenerationQueueWindowOpen(
  settings: GenerationQueueSettings,
  currentMinute: number,
) {
  if (!settings.nightModeEnabled) return true;
  const start = timeToMinutes(settings.startTime),
    end = timeToMinutes(settings.endTime);
  if (start === end) return true;
  return start < end
    ? currentMinute >= start && currentMinute < end
    : currentMinute >= start || currentMinute < end;
}
export function minutesUntilGenerationQueueWindow(
  settings: GenerationQueueSettings,
  currentMinute: number,
) {
  if (isGenerationQueueWindowOpen(settings, currentMinute)) return 0;
  const start = timeToMinutes(settings.startTime);
  return (start - currentMinute + 24 * 60) % (24 * 60);
}
export type AIModelInfo = {
  id: string;
  name: string;
  size?: number;
  modifiedAt?: string;
};
export const imageGenerationProviderIdSchema = z.enum([
  "dezgo",
  "comfyui",
  "local_comfyui",
  "mangai_cloud",
  "render_node",
  "asset_library",
]);
export type ImageGenerationProviderId = z.infer<
  typeof imageGenerationProviderIdSchema
>;
export const imageGenerationJobTypeSchema = z.enum([
  "text_to_image",
  "image_to_image",
  "controlnet",
  "inpainting",
  "upscale",
  "remove_background",
]);
export type ImageGenerationJobType = z.infer<
  typeof imageGenerationJobTypeSchema
>;
export type ImageGenerationModelMetadata = AIModelInfo & {
  family?: string;
  description?: string;
  license?: string;
  categories?: string[];
  supportedFunctions?: ImageGenerationJobType[];
  nativeResolution?: { width: number; height: number };
  triggers?: string[] | null;
  fetchedAt?: string;
};
export type ProviderConnectionResult = {
  ok: boolean;
  message: string;
  latencyMs?: number;
};
export type GenerationContext = {
  projectId?: string;
  episodeId?: string;
  pageId?: string;
  summary?: string;
};
export type TextGenerationRequest = {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};
export type TextGenerationResult = {
  text: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  raw?: unknown;
};
export type TextGenerationChunk = {
  text: string;
  done: boolean;
  model?: string;
};
export type ImageGenerationRequest = {
  workflowId: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  operation?: "text_to_image" | "image_to_image" | "controlnet" | "inpainting";
  inputImage?: GenerationInputImage;
  maskImage?: GenerationInputImage;
  denoiseStrength?: number;
};
export type GenerationInputImage = {
  fileName: string;
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};
export type ImageGenerationResult = {
  providerJobId: string;
  images: Array<{ fileName: string; bytes: Uint8Array; mimeType: string }>;
  raw?: unknown;
};
export type ProviderJobStatus = {
  status: GenerationStatus;
  progress?: number;
  error?: string;
  outputs?: unknown;
};

export interface TextGenerationProvider {
  id: string;
  name: string;
  checkConnection(signal?: AbortSignal): Promise<ProviderConnectionResult>;
  listModels(signal?: AbortSignal): Promise<AIModelInfo[]>;
  generateText(
    request: TextGenerationRequest,
    context?: GenerationContext,
    signal?: AbortSignal,
  ): Promise<TextGenerationResult>;
  streamText?(
    request: TextGenerationRequest,
    context?: GenerationContext,
    signal?: AbortSignal,
  ): AsyncIterable<TextGenerationChunk>;
}
export interface ImageGenerationProvider {
  id: string;
  name: string;
  checkConnection(signal?: AbortSignal): Promise<ProviderConnectionResult>;
  listModels?(signal?: AbortSignal): Promise<AIModelInfo[]>;
  getBalance?(signal?: AbortSignal): Promise<number | null>;
  generateImage(
    request: ImageGenerationRequest,
    context?: GenerationContext,
    signal?: AbortSignal,
  ): Promise<ImageGenerationResult>;
  getJobStatus?(
    providerJobId: string,
    signal?: AbortSignal,
  ): Promise<ProviderJobStatus>;
  cancelJob?(providerJobId: string): Promise<void>;
}

export const providerSettingsSchema = z.object({
  providerId: z.enum(["ollama", "comfyui", "mock"]),
  enabled: z.boolean(),
  baseUrl: z.string().url(),
  modelId: z.string().max(200).default(""),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(131072).default(2048),
  timeoutMs: z.number().int().min(1000).max(3600000).default(120000),
  stream: z.boolean().default(true),
  pollIntervalMs: z.number().int().min(250).max(60000).default(1000),
  allowedOrigins: z.array(z.string().url()).max(20).default([]),
});
export type ProviderSettings = z.infer<typeof providerSettingsSchema>;
export const chatSendSchema = z.object({
  sessionId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  episodeId: z.string().uuid().optional(),
  pageId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(50000),
  templateId: z.string().uuid().optional(),
  includeContext: z.boolean().default(true),
});
export const chatRequestSchema = chatSendSchema.extend({
  requestId: z.string().uuid(),
});
export const cancelRequestSchema = z.object({ requestId: z.string().uuid() });
export const imageJobRequestSchema = z
  .object({
    projectId: z.string().uuid(),
    episodeId: z.string().uuid().optional(),
    pageId: z.string().uuid().optional(),
    workflowId: z.string().uuid(),
    prompt: z.string().trim().min(1).max(50000),
    negativePrompt: z.string().max(50000).default(""),
    width: z.number().int().min(64).max(8192).optional(),
    height: z.number().int().min(64).max(8192).optional(),
    seed: z.number().int().nonnegative().optional(),
    operation: z
      .enum(["text_to_image", "image_to_image", "controlnet", "inpainting"])
      .default("text_to_image"),
    sourceAssetId: z.string().uuid().optional(),
    maskAssetId: z.string().uuid().optional(),
    characterProfileId: z.string().uuid().optional(),
    denoiseStrength: z.number().min(0).max(1).default(0.65),
    jobType: z
      .union([safeAssetJobTypeSchema, z.literal("adult_character_render")])
      .optional(),
    adultContentConfirmation:
      adultGenerationContentConfirmationSchema.optional(),
    libraryTags: z
      .array(z.string().trim().min(1).max(50))
      .max(20)
      .transform((tags) => [...new Set(tags)])
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.operation !== "text_to_image" && !value.sourceAssetId)
      context.addIssue({
        code: "custom",
        path: ["sourceAssetId"],
        message: "この生成モードには入力画像が必要です。",
      });
    if (value.operation === "inpainting" && !value.maskAssetId)
      context.addIssue({
        code: "custom",
        path: ["maskAssetId"],
        message: "Inpaintingにはマスク画像が必要です。",
      });
    if (value.operation !== "inpainting" && value.maskAssetId)
      context.addIssue({
        code: "custom",
        path: ["maskAssetId"],
        message: "マスク画像はInpaintingでのみ指定できます。",
      });
    if (
      value.jobType === "adult_character_render" &&
      !value.adultContentConfirmation
    )
      context.addIssue({
        code: "custom",
        path: ["adultContentConfirmation"],
        message: "成人向け生成には内容確認が必要です。",
      });
    if (
      value.jobType !== "adult_character_render" &&
      value.adultContentConfirmation
    )
      context.addIssue({
        code: "custom",
        path: ["adultContentConfirmation"],
        message: "成人向け内容確認を通常生成へ付与できません。",
      });
  });
export type ImageJobRequest = z.infer<typeof imageJobRequestSchema>;
export const pageBatchImageRequestSchema = z.object({
  projectId: z.string().uuid(),
  episodeId: z.string().uuid(),
  workflowId: z.string().uuid(),
  pageIds: z.array(z.string().uuid()).min(1).max(100),
});
export type PageBatchImageRequest = z.infer<typeof pageBatchImageRequestSchema>;
export type ComfyWorkflowOptimization = {
  hasTiledVaeDecode: boolean;
  hasTiledVaeEncode: boolean;
  hasStandardVaeDecode: boolean;
  lowSpecVaeReady: boolean;
  cpuOffloadVerification: "runtime_required";
  nodeTypes: string[];
};
export type ComfyLowSpecRuntimeReport = {
  comfyuiVersion: string | null;
  devices: Array<{
    name: string;
    type: string;
    vramTotalBytes: number | null;
    vramFreeBytes: number | null;
  }>;
  tiledVaeNodeAvailable: boolean;
  cpuVaeEnabled: boolean;
  lowVramMode: "dynamic" | "lowvram" | "novram" | "disabled";
  dynamicVramEnabled: boolean;
  reserveVramGb: number | null;
  runtimeChecksPassed: boolean;
};
export function analyzeComfyWorkflowOptimization(
  workflow: Record<string, unknown>,
): ComfyWorkflowOptimization {
  const nodeTypes = Array.from(
    new Set(
      Object.values(workflow)
        .map((node) =>
          node && typeof node === "object" && "class_type" in node
            ? String((node as { class_type?: unknown }).class_type ?? "")
            : "",
        )
        .filter(Boolean),
    ),
  ).sort();
  const normalized = nodeTypes.map((value) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  const hasTiledVaeDecode = normalized.some((value) =>
      value.includes("vaedecodetiled"),
    ),
    hasTiledVaeEncode = normalized.some((value) =>
      value.includes("vaeencodetiled"),
    ),
    hasStandardVaeDecode = normalized.some(
      (value) => value.includes("vaedecode") && !value.includes("tiled"),
    );
  return {
    hasTiledVaeDecode,
    hasTiledVaeEncode,
    hasStandardVaeDecode,
    lowSpecVaeReady: hasTiledVaeDecode,
    cpuOffloadVerification: "runtime_required",
    nodeTypes,
  };
}
export const chatSessionIdSchema = z.object({ id: z.string().uuid() });
export const renameChatSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
});
export const workflowMappingSchema = z.object({
  prompt: z.object({ nodeId: z.string(), input: z.string() }),
  negativePrompt: z
    .object({ nodeId: z.string(), input: z.string() })
    .optional(),
  width: z.object({ nodeId: z.string(), input: z.string() }).optional(),
  height: z.object({ nodeId: z.string(), input: z.string() }).optional(),
  seed: z.object({ nodeId: z.string(), input: z.string() }).optional(),
  sourceImage: z.object({ nodeId: z.string(), input: z.string() }).optional(),
  controlImage: z.object({ nodeId: z.string(), input: z.string() }).optional(),
  maskImage: z.object({ nodeId: z.string(), input: z.string() }).optional(),
  denoiseStrength: z
    .object({ nodeId: z.string(), input: z.string() })
    .optional(),
});
export const workflowInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  filePath: z.string().min(1),
  mapping: workflowMappingSchema,
});
export const workflowUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  mapping: workflowMappingSchema,
});
export const promptTemplateInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  template: z.string().trim().min(1).max(50000),
  systemPrompt: z.string().max(50000).default(""),
});

export const defaultPromptTemplates = [
  [
    "漫画企画を考える",
    "この漫画の企画案を、テーマ、読者、魅力、展開の観点から提案してください。",
  ],
  [
    "あらすじを作る",
    "この漫画のあらすじを、導入・展開・転換・結末が分かる形で作成してください。",
  ],
  [
    "キャラクター設定を作る",
    "主要キャラクターの性格、目的、弱点、関係性を設定してください。",
  ],
  [
    "世界観設定を作る",
    "舞台、時代、社会、ルール、物語上の制約を含む世界観を作成してください。",
  ],
  ["1話分の構成を作る", "1話分の構成をシーン単位で作成してください。"],
  [
    "ページ構成を作る",
    "指定内容を漫画ページ単位に分解し、各ページの役割を提案してください。",
  ],
  [
    "セリフ案を作る",
    "キャラクター性と場面に合う自然なセリフ案を作成してください。",
  ],
  [
    "画像生成プロンプトを作る",
    "漫画画像生成向けの具体的なプロンプトを作成してください。",
  ],
  [
    "ネガティブプロンプトを作る",
    "画像生成で避ける要素をネガティブプロンプトとして整理してください。",
  ],
  [
    "販売説明文を作る",
    "作品の魅力が伝わる正確な販売説明文を作成してください。",
  ],
  ["SNS告知文を作る", "作品を紹介する簡潔なSNS告知文を作成してください。"],
] as const;

export class AIProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = false,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
