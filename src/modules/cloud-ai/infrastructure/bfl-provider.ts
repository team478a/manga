import { z } from "zod";
import sharp from "sharp";
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
    .nullable()
    .optional(),
});

const modelCostMicros = {
  "flux-2-klein-9b": 15_000,
  "flux-2-pro": 30_000,
  "flux-2-max": 70_000,
  "flux-pro-1.0-fill": 50_000,
} as const;

type FluxModel = keyof typeof modelCostMicros;

type FluxProviderConfig = {
  apiKey: string;
  model: FluxModel;
  capability: CloudProviderCapability;
  fetcher?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onDiagnostic?: (diagnostic: BflProviderDiagnostic) => void;
};

export type BflProviderDiagnostic = {
  stage: "submit" | "poll" | "download";
  outcome:
    | "http_rejected"
    | "provider_failed"
    | "response_invalid"
    | "timeout";
  httpStatus?: number;
};

const DEFAULT_BFL_TIMEOUT_MS = 210_000;

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

function providerError(
  status: number,
  stage?: BflProviderDiagnostic["stage"],
  onDiagnostic?: FluxProviderConfig["onDiagnostic"],
) {
  if (stage)
    onDiagnostic?.({ stage, outcome: "http_rejected", httpStatus: status });
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

async function fetchImageBytes(
  fetcher: typeof fetch,
  url: string,
  signal: AbortSignal,
) {
  if (!url)
    throw new AIProviderError(
      "provider_rejected",
      "部分修正に必要な画像を確認できませんでした。",
      false,
    );
  const response = await fetcher(url, {
    method: "GET",
    redirect: "error",
    signal,
  });
  if (!response.ok) throw providerError(response.status);
  const contentType = response.headers.get("content-type")?.split(";")[0];
  if (!contentType?.startsWith("image/"))
    throw new AIProviderError(
      "provider_rejected",
      "修正元画像を検証できませんでした。",
      false,
    );
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > 25_000_000)
    throw new AIProviderError(
      "response_too_large",
      "修正元画像が処理上限を超えました。",
      false,
    );
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 25_000_000)
    throw new AIProviderError(
      "response_too_large",
      "修正元画像が処理上限を超えました。",
      false,
    );
  return bytes;
}

type OutpaintingDirection = "left" | "right" | "top" | "bottom" | "all";

function extensionSize(size: number, bothSides: boolean) {
  const available = 2048 - size;
  const requested = Math.max(16, Math.round(size * (bothSides ? 0.125 : 0.25)));
  return bothSides
    ? Math.min(requested, Math.floor(available / 2))
    : Math.min(requested, available);
}

async function prepareOutpainting(
  bytes: Uint8Array,
  direction: OutpaintingDirection,
) {
  const source = Buffer.from(bytes);
  const metadata = await sharp(source, { limitInputPixels: 50_000_000 }).metadata();
  if (!metadata.width || !metadata.height)
    throw new AIProviderError(
      "provider_rejected",
      "画角拡張する画像のサイズを確認できませんでした。",
      false,
    );
  const horizontal = direction === "all"
    ? extensionSize(metadata.width, true)
    : direction === "left" || direction === "right"
      ? extensionSize(metadata.width, false)
      : 0;
  const vertical = direction === "all"
    ? extensionSize(metadata.height, true)
    : direction === "top" || direction === "bottom"
      ? extensionSize(metadata.height, false)
      : 0;
  if ((direction === "all" && (!horizontal || !vertical)) ||
      (direction !== "all" && !horizontal && !vertical))
    throw new AIProviderError(
      "provider_rejected",
      "画像サイズが画角拡張の上限に達しています。",
      false,
    );
  const extend = {
    left: direction === "left" || direction === "all" ? horizontal : 0,
    right: direction === "right" || direction === "all" ? horizontal : 0,
    top: direction === "top" || direction === "all" ? vertical : 0,
    bottom: direction === "bottom" || direction === "all" ? vertical : 0,
  };
  const image = await sharp(source, { limitInputPixels: 50_000_000 })
    .extend({ ...extend, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();
  const blackMask = await sharp({
    create: {
      width: metadata.width,
      height: metadata.height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
  const mask = await sharp(blackMask)
    .extend({ ...extend, background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();
  if (image.length > 25_000_000 || mask.length > 25_000_000)
    throw new AIProviderError(
      "response_too_large",
      "画角拡張用画像が処理上限を超えました。",
      false,
    );
  return {
    image: image.toString("base64"),
    mask: mask.toString("base64"),
  };
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
      this.config.timeoutMs ?? DEFAULT_BFL_TIMEOUT_MS,
    );
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    let diagnosticStage: BflProviderDiagnostic["stage"] = "submit";
    try {
      const prompt = input.negativePrompt.trim()
        ? `${input.prompt}\nAvoid: ${input.negativePrompt}`
        : input.prompt;
      const usesFill =
        input.operation === "inpainting" || input.operation === "outpainting";
      const isFillModel = this.config.model === "flux-pro-1.0-fill";
      if (isFillModel !== usesFill)
        throw new AIProviderError(
          "provider_rejected",
          "画像修正方式とProvider設定が一致しません。",
          false,
        );
      const referenceImageUrls = (context.referenceImageUrls ?? []).slice(
        0,
        this.config.model === "flux-2-klein-9b" ? 4 : 8,
      );
      let fillInput: { image: string; mask: string } | null = null;
      if (input.operation === "inpainting") {
        const [image, mask] = await Promise.all([
          fetchImageBytes(
            fetcher,
            referenceImageUrls[0] ?? "",
            controller.signal,
          ),
          fetchImageBytes(
            fetcher,
            context.maskImageUrl ?? "",
            controller.signal,
          ),
        ]);
        fillInput = {
          image: Buffer.from(image).toString("base64"),
          mask: Buffer.from(mask).toString("base64"),
        };
      } else if (input.operation === "outpainting") {
        const source = await fetchImageBytes(
          fetcher,
          referenceImageUrls[0] ?? "",
          controller.signal,
        );
        fillInput = await prepareOutpainting(
          source,
          input.outpaintingDirection!,
        );
      }
      const requestBody = fillInput
        ? {
            prompt,
            ...fillInput,
            output_format: "png",
            safety_tolerance: 1,
          }
        : {
            prompt,
            ...Object.fromEntries(
              referenceImageUrls.map((url, index) => [
                index === 0 ? "input_image" : `input_image_${index + 1}`,
                url,
              ]),
            ),
            width: normalizeDimension(input.width),
            height: normalizeDimension(input.height),
            seed: input.seed,
            output_format: "png",
            safety_tolerance: 1,
          };
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
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        },
      );
      if (!submitted.ok)
        throw providerError(
          submitted.status,
          "submit",
          this.config.onDiagnostic,
        );
      const job = submitResponseSchema.parse(await submitted.json());
      const pollingUrl = safeBflUrl(job.polling_url);
      const startedAt = Date.now();
      while (Date.now() - startedAt < (this.config.timeoutMs ?? DEFAULT_BFL_TIMEOUT_MS)) {
        diagnosticStage = "poll";
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
        if (!response.ok)
          throw providerError(
            response.status,
            "poll",
            this.config.onDiagnostic,
          );
        const result = pollResponseSchema.parse(await response.json());
        if (result.status === "Error" || result.status === "Failed") {
          this.config.onDiagnostic?.({
            stage: "poll",
            outcome: "provider_failed",
          });
          throw new AIProviderError(
            "provider_rejected",
            "画像生成サービスが生成を完了できませんでした。",
            false,
          );
        }
        if (result.status !== "Ready") continue;
        if (!result.result?.sample)
          throw new AIProviderError(
            "provider_rejected",
            "画像生成結果を取得できませんでした。",
            false,
          );
        const imageUrl = safeBflUrl(result.result.sample);
        diagnosticStage = "download";
        const imageResponse = await fetcher(imageUrl, {
          method: "GET",
          redirect: "error",
          signal: controller.signal,
        });
        if (!imageResponse.ok)
          throw providerError(
            imageResponse.status,
            "download",
            this.config.onDiagnostic,
          );
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
      this.config.onDiagnostic?.({
        stage: diagnosticStage,
        outcome: "timeout",
      });
      throw new AIProviderError(
        "timeout",
        "画像生成がタイムアウトしました。",
        true,
      );
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (controller.signal.aborted) {
        this.config.onDiagnostic?.({
          stage: diagnosticStage,
          outcome: "timeout",
        });
        throw new AIProviderError(
          "timeout",
          "画像生成がタイムアウトしました。",
          true,
        );
      }
      if (error instanceof z.ZodError) {
        this.config.onDiagnostic?.({
          stage: diagnosticStage,
          outcome: "response_invalid",
        });
        throw new AIProviderError(
          "provider_rejected",
          "画像生成サービスの応答を検証できませんでした。",
          false,
        );
      }
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
