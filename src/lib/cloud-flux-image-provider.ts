import { z } from "zod";
import {
  AIProviderError,
  type CloudGenerationContext,
  type CloudGenerationInput,
  type CloudImageGenerationProvider,
  type CloudProviderCapability,
} from "@mangai/ai-core";

const submitResponseSchema = z.object({
  id: z.string().min(1).max(300),
  polling_url: z.string().url(),
});
const pollResponseSchema = z.object({
  status: z.string(),
  result: z
    .object({
      sample: z.string().url(),
    })
    .optional(),
});

const modelCostMicros = {
  "flux-2-klein-9b": 15_000,
  "flux-2-pro": 30_000,
  "flux-2-max": 70_000,
} as const;

type FluxModel = keyof typeof modelCostMicros;

type FluxProviderConfig = {
  apiKey: string;
  model: FluxModel;
  capability: CloudProviderCapability;
  fetcher?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

function safeBflUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "bfl.ai" || url.hostname.endsWith(".bfl.ai"))
  )
    throw new AIProviderError(
      "provider_rejected",
      "Provider応答の取得先を検証できませんでした。",
      false,
    );
  return url.toString();
}

function normalizeDimension(value: number | undefined) {
  const bounded = Math.min(2048, Math.max(256, value ?? 1024));
  return Math.round(bounded / 16) * 16;
}

function providerError(status: number) {
  if (status === 429)
    return new AIProviderError(
      "rate_limited",
      "画像生成が混み合っています。時間をおいて再試行してください。",
      true,
    );
  if (status >= 500)
    return new AIProviderError(
      "provider_5xx",
      "画像生成サービスが一時的に利用できません。",
      true,
    );
  return new AIProviderError(
    "provider_rejected",
    "画像生成サービスが要求を受け付けませんでした。",
    false,
  );
}

export class BlackForestLabsFluxImageProvider implements CloudImageGenerationProvider {
  readonly capability: CloudProviderCapability & { kind: "image" };
  private readonly config: FluxProviderConfig;

  constructor(config: FluxProviderConfig) {
    if (
      config.capability.kind !== "image" ||
      config.capability.providerId !== "black-forest-labs" ||
      config.capability.modelId !== config.model
    )
      throw new Error("BFL画像Provider設定が一致しません。");
    if (config.apiKey.length < 20 || /\s/.test(config.apiKey))
      throw new Error("BFL API keyが不正です。");
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
    const fetcher = this.config.fetcher ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? 120_000,
    );
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const prompt = input.negativePrompt.trim()
        ? `${input.prompt}\nAvoid: ${input.negativePrompt}`
        : input.prompt;
      const referenceImageUrls = (context.referenceImageUrls ?? []).slice(
        0,
        this.config.model === "flux-2-klein-9b" ? 4 : 8,
      );
      const referenceImages = Object.fromEntries(
        referenceImageUrls.map((url, index) => [
          index === 0 ? "input_image" : `input_image_${index + 1}`,
          url,
        ]),
      );
      const submitted = await fetcher(
        `https://api.bfl.ai/v1/${this.config.model}`,
        {
          method: "POST",
          redirect: "error",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "x-key": this.config.apiKey,
          },
          body: JSON.stringify({
            prompt,
            ...referenceImages,
            width: normalizeDimension(input.width),
            height: normalizeDimension(input.height),
            seed: input.seed,
            output_format: "png",
            safety_tolerance: 1,
          }),
          signal: controller.signal,
        },
      );
      if (!submitted.ok) throw providerError(submitted.status);
      const job = submitResponseSchema.parse(await submitted.json());
      const pollingUrl = safeBflUrl(job.polling_url);
      const startedAt = Date.now();
      while (Date.now() - startedAt < (this.config.timeoutMs ?? 120_000)) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            resolve,
            Math.max(100, this.config.pollIntervalMs ?? 500),
          );
          controller.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(controller.signal.reason);
            },
            { once: true },
          );
        });
        const response = await fetcher(pollingUrl, {
          method: "GET",
          redirect: "error",
          headers: { accept: "application/json", "x-key": this.config.apiKey },
          signal: controller.signal,
        });
        if (!response.ok) throw providerError(response.status);
        const result = pollResponseSchema.parse(await response.json());
        if (result.status === "Error" || result.status === "Failed")
          throw new AIProviderError(
            "provider_rejected",
            "画像生成サービスが生成を完了できませんでした。",
            false,
          );
        if (result.status !== "Ready") continue;
        if (!result.result?.sample)
          throw new AIProviderError(
            "provider_rejected",
            "画像生成結果を取得できませんでした。",
            false,
          );
        const imageUrl = safeBflUrl(result.result.sample);
        const imageResponse = await fetcher(imageUrl, {
          method: "GET",
          redirect: "error",
          signal: controller.signal,
        });
        if (!imageResponse.ok) throw providerError(imageResponse.status);
        const length = Number(imageResponse.headers.get("content-length") ?? 0);
        if (length > 25_000_000)
          throw new AIProviderError(
            "response_too_large",
            "生成画像が保存上限を超えました。",
            false,
          );
        const bytes = new Uint8Array(await imageResponse.arrayBuffer());
        if (!bytes.length || bytes.length > 25_000_000)
          throw new AIProviderError(
            "response_too_large",
            "生成画像が保存上限を超えました。",
            false,
          );
        return {
          providerJobId: job.id,
          images: [
            {
              bytes,
              mimeType: "image/png",
              fileName: `${context.jobId}.png`,
            },
          ],
          usage: { actualCostMicros: modelCostMicros[this.config.model] },
          providerModeration: {
            decision: "allow" as const,
            reasons: [],
            policyVersion: 1 as const,
          },
        };
      }
      throw new AIProviderError(
        "timeout",
        "画像生成がタイムアウトしました。",
        true,
      );
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (controller.signal.aborted)
        throw new AIProviderError(
          "timeout",
          "画像生成がタイムアウトしました。",
          true,
        );
      if (error instanceof z.ZodError)
        throw new AIProviderError(
          "provider_rejected",
          "画像生成サービスの応答を検証できませんでした。",
          false,
        );
      throw new AIProviderError(
        "network_error",
        "画像生成サービスへ接続できませんでした。",
        true,
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
}
