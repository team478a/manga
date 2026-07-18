import { z } from "zod";
import {
  AIProviderError,
  cloudModerationResultSchema,
  type CloudGenerationContext,
  type CloudGenerationInput,
  type CloudImageGenerationProvider,
  type CloudProviderCapability,
  type CloudTextGenerationProvider,
} from "@mangai/ai-core";

const usageSchema = z.object({
  inputUnits: z.number().int().nonnegative().optional(),
  outputUnits: z.number().int().nonnegative().optional(),
  actualCostMicros: z.number().int().nonnegative().optional(),
});
const commonResponseSchema = z.object({
  providerJobId: z.string().max(300).optional(),
  usage: usageSchema.default({}),
  moderation: cloudModerationResultSchema,
});
const imageResponseSchema = commonResponseSchema.extend({
  images: z
    .array(
      z.object({
        base64: z.string().min(1).max(28_000_000),
        mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
        fileName: z.string().min(1).max(255),
      }),
    )
    .min(1)
    .max(4),
});
const textResponseSchema = commonResponseSchema.extend({
  text: z.string().min(1).max(50_000),
});

type GatewayConfig = {
  endpoint: string;
  apiKey: string;
  capability: CloudProviderCapability;
  timeoutMs?: number;
  fetcher?: typeof fetch;
};

function assertGatewayEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (
    url.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && local)
  )
    throw new Error("Cloud AI GatewayはHTTPSで設定してください。");
  return url.toString();
}

async function gatewayRequest(
  config: GatewayConfig,
  input: CloudGenerationInput,
  context: CloudGenerationContext,
  signal?: AbortSignal,
) {
  if (config.apiKey.length < 16)
    throw new Error("Cloud AI Gateway keyが不正です。");
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? 120_000,
  );
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await (config.fetcher ?? fetch)(
      assertGatewayEndpoint(config.endpoint),
      {
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
          "x-mangai-idempotency-key": context.idempotencyKey,
          "x-mangai-job-id": context.jobId,
        },
        body: JSON.stringify({
          model: config.capability.modelId,
          input,
          context: {
            jobId: context.jobId,
            projectId: context.projectId,
            pageId: context.pageId,
          },
        }),
        signal: controller.signal,
      },
    );
    if (response.status === 429)
      throw new AIProviderError(
        "rate_limited",
        "Providerのrate limitに達しました。",
        true,
      );
    if (response.status >= 500)
      throw new AIProviderError(
        "provider_5xx",
        "Providerが一時的に利用できません。",
        true,
      );
    if (!response.ok)
      throw new AIProviderError(
        "provider_rejected",
        `Providerが要求を拒否しました（${response.status}）。`,
        false,
      );
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 30_000_000)
      throw new AIProviderError(
        "response_too_large",
        "Provider応答が上限を超えました。",
        false,
      );
    return await response.json();
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    if (controller.signal.aborted)
      throw new AIProviderError(
        "timeout",
        "Providerがタイムアウトしました。",
        true,
      );
    throw new AIProviderError(
      "network_error",
      "Providerへ接続できませんでした。",
      true,
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

function assertProviderModeration(
  value: z.infer<typeof cloudModerationResultSchema>,
) {
  if (value.decision !== "allow")
    throw new AIProviderError(
      "provider_moderation_blocked",
      `Provider moderationで拒否されました: ${value.reasons.join(", ") || "review"}`,
      false,
    );
}

export class MangaiCloudGatewayImageProvider implements CloudImageGenerationProvider {
  readonly capability: CloudProviderCapability & { kind: "image" };
  private readonly config: GatewayConfig;
  constructor(config: GatewayConfig) {
    if (config.capability.kind !== "image")
      throw new Error("画像Provider設定が必要です。");
    this.capability = config.capability as CloudProviderCapability & {
      kind: "image";
    };
    this.config = config;
  }
  async generate(
    input: CloudGenerationInput & { kind: "image" },
    context: CloudGenerationContext,
    signal?: AbortSignal,
  ) {
    const parsed = imageResponseSchema.parse(
      await gatewayRequest(this.config, input, context, signal),
    );
    assertProviderModeration(parsed.moderation);
    return {
      providerJobId: parsed.providerJobId,
      images: parsed.images.map((image) => ({
        bytes: new Uint8Array(Buffer.from(image.base64, "base64")),
        mimeType: image.mimeType,
        fileName: image.fileName,
      })),
      usage: parsed.usage,
      providerModeration: parsed.moderation,
    };
  }
}

export class MangaiCloudGatewayTextProvider implements CloudTextGenerationProvider {
  readonly capability: CloudProviderCapability & { kind: "text" };
  private readonly config: GatewayConfig;
  constructor(config: GatewayConfig) {
    if (config.capability.kind !== "text")
      throw new Error("文章Provider設定が必要です。");
    this.capability = config.capability as CloudProviderCapability & {
      kind: "text";
    };
    this.config = config;
  }
  async generate(
    input: CloudGenerationInput & { kind: "text" },
    context: CloudGenerationContext,
    signal?: AbortSignal,
  ) {
    const parsed = textResponseSchema.parse(
      await gatewayRequest(this.config, input, context, signal),
    );
    assertProviderModeration(parsed.moderation);
    return {
      providerJobId: parsed.providerJobId,
      text: parsed.text,
      usage: parsed.usage,
      providerModeration: parsed.moderation,
    };
  }
}
