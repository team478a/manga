import crypto from "node:crypto";
import { z } from "zod";
import {
  AIProviderError,
  type ImageGenerationJobType,
  type ImageGenerationModelMetadata,
  type ImageGenerationProvider,
  type ImageGenerationResult,
  type ProviderConnectionResult,
} from "@mangai/ai-core";

const DEZGO_BASE_URL = "https://api.dezgo.com";
const CONNECTION_TIMEOUT_MS = 15_000;
const GENERATION_TIMEOUT_MS = 180_000;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export const dezgoTextToImageRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(1000),
  negativePrompt: z.string().max(1000).default(""),
  model: z.string().trim().min(1).max(300),
  width: z.number().int().min(320).max(1024).refine((value) => value % 8 === 0),
  height: z.number().int().min(320).max(1024).refine((value) => value % 8 === 0),
  guidance: z.number().finite().min(-20).max(20).default(7),
  steps: z.number().int().min(10).max(150).default(30),
  sampler: z
    .enum([
      "ddim",
      "dpm",
      "dpm_single",
      "dpmpp_2m_karras",
      "euler",
      "euler_a",
      "k_lms",
      "pndm",
    ])
    .default("dpmpp_2m_karras"),
  seed: z.number().int().min(0).max(4_294_967_295).optional(),
  format: z.enum(["jpg", "png", "webp"]).default("png"),
});
export type DezgoTextToImageRequest = z.infer<
  typeof dezgoTextToImageRequestSchema
>;
export type DezgoGenerationMetadata = {
  seed: number | null;
  actualCostUsd: number | null;
  balanceUsd: number | null;
  balanceIndex: number | null;
};
export type DezgoTextToImageResult = ImageGenerationResult & {
  metadata: DezgoGenerationMetadata;
};

const modelSchema = z
  .object({
    id: z.string().trim().min(1).max(300),
    name: z.string().trim().min(1).max(500),
    family: z.string().trim().max(100).nullable().optional(),
    description: z.string().max(5000).nullable().optional(),
    license: z.string().max(1000).nullable().optional(),
    categories: z.array(z.string().max(200)).max(100).nullable().optional(),
    functions: z.array(z.string().max(200)).max(100).nullable().optional(),
    nativeResolution: z
      .object({
        width: z.number().int().positive().max(32768),
        height: z.number().int().positive().max(32768),
      })
      .nullable()
      .optional(),
    triggers: z.array(z.string().max(1000)).max(100).nullable().optional(),
  })
  .passthrough();
const infoSchema = z
  .object({
    name: z.string().nullable().optional(),
    version: z.string().nullable().optional(),
    models: z.array(modelSchema).max(2000).nullable().optional(),
  })
  .passthrough();
const ledgerEntrySchema = z
  .object({ balance: z.number().finite() })
  .passthrough();

const functionMap: Record<string, ImageGenerationJobType> = {
  text2image: "text_to_image",
  image2image: "image_to_image",
  controlnet: "controlnet",
  inpainting: "inpainting",
  upscale: "upscale",
  "remove-background": "remove_background",
};

function httpError(status: number) {
  if (status === 400)
    return new AIProviderError(
      "DEZGO_INPUT_INVALID",
      "Dezgoへの入力または設定が正しくありません。",
    );
  if (status === 401)
    return new AIProviderError(
      "DEZGO_API_KEY_INVALID",
      "Dezgo APIキーが無効です。",
    );
  if (status === 402)
    return new AIProviderError(
      "DEZGO_BALANCE_INSUFFICIENT",
      "Dezgoの残高が不足しています。",
    );
  if (status === 403)
    return new AIProviderError(
      "DEZGO_NOT_ALLOWED",
      "Dezgoでこの処理は許可されていません。",
    );
  if (status === 404)
    return new AIProviderError(
      "DEZGO_NOT_FOUND",
      "Dezgo APIまたはモデルが見つかりません。",
    );
  if (status === 429)
    return new AIProviderError(
      "DEZGO_RATE_LIMITED",
      "Dezgo APIが混雑しています。しばらく待ってから再試行してください。",
      true,
    );
  if (status >= 500)
    return new AIProviderError(
      "DEZGO_SERVICE_ERROR",
      "Dezgo APIで一時的なエラーが発生しました。",
      true,
    );
  return new AIProviderError(
    "DEZGO_HTTP_ERROR",
    `Dezgo APIがHTTP ${status}を返しました。`,
  );
}

export class DezgoClient {
  constructor(
    private readonly getApiKey: () => Promise<string | null>,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = CONNECTION_TIMEOUT_MS,
    private readonly generationTimeoutMs = GENERATION_TIMEOUT_MS,
  ) {}

  private async requestJson(
    path: "/info" | "/account/tx/last",
    signal?: AbortSignal,
  ) {
    const apiKey = await this.getApiKey();
    if (!apiKey)
      throw new AIProviderError(
        "DEZGO_CREDENTIAL_MISSING",
        "Dezgo APIキーが設定されていません。",
      );
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      const response = await this.fetchImpl(`${DEZGO_BASE_URL}${path}`, {
        method: "GET",
        redirect: "error",
        headers: {
          accept: "application/json",
          "X-Dezgo-Key": apiKey,
        },
        signal: controller.signal,
      });
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES)
        throw new AIProviderError(
          "DEZGO_RESPONSE_TOO_LARGE",
          "Dezgo APIの応答が大きすぎます。",
        );
      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > MAX_JSON_BYTES)
        throw new AIProviderError(
          "DEZGO_RESPONSE_TOO_LARGE",
          "Dezgo APIの応答が大きすぎます。",
        );
      if (!response.ok) throw httpError(response.status);
      try {
        return JSON.parse(body) as unknown;
      } catch {
        throw new AIProviderError(
          "DEZGO_RESPONSE_INVALID",
          "Dezgo APIの応答を確認できませんでした。",
        );
      }
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (signal?.aborted)
        throw new AIProviderError(
          "DEZGO_CANCELED",
          "Dezgo APIへの接続をキャンセルしました。",
        );
      if (timedOut)
        throw new AIProviderError(
          "DEZGO_TIMEOUT",
          "Dezgo APIへの接続がタイムアウトしました。",
          true,
        );
      throw new AIProviderError(
        "DEZGO_CONNECTION_FAILED",
        "Dezgo APIへ接続できません。接続を確認してください。",
        true,
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  }

  async info(signal?: AbortSignal) {
    const result = infoSchema.safeParse(await this.requestJson("/info", signal));
    if (!result.success)
      throw new AIProviderError(
        "DEZGO_RESPONSE_INVALID",
        "Dezgo APIの応答を確認できませんでした。",
      );
    return result.data;
  }

  async balance(signal?: AbortSignal) {
    const result = ledgerEntrySchema.safeParse(
      await this.requestJson("/account/tx/last", signal),
    );
    if (!result.success)
      throw new AIProviderError(
        "DEZGO_RESPONSE_INVALID",
        "Dezgo APIの応答を確認できませんでした。",
      );
    return result.data.balance;
  }

  async textToImage(
    input: DezgoTextToImageRequest,
    signal?: AbortSignal,
  ): Promise<DezgoTextToImageResult> {
    const parsedRequest = dezgoTextToImageRequestSchema.safeParse(input);
    if (!parsedRequest.success)
      throw new AIProviderError(
        "DEZGO_INPUT_INVALID",
        "Dezgo画像生成の入力が正しくありません。",
      );
    const request = parsedRequest.data;
    const apiKey = await this.getApiKey();
    if (!apiKey)
      throw new AIProviderError(
        "DEZGO_CREDENTIAL_MISSING",
        "Dezgo APIキーが設定されていません。",
      );
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.generationTimeoutMs);
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      const response = await this.fetchImpl(`${DEZGO_BASE_URL}/text2image`, {
        method: "POST",
        redirect: "error",
        headers: {
          accept: "image/png,image/jpeg,image/webp",
          "content-type": "application/json",
          "X-Dezgo-Key": apiKey,
        },
        body: JSON.stringify({
          prompt: request.prompt,
          negative_prompt: request.negativePrompt,
          model: request.model,
          width: request.width,
          height: request.height,
          guidance: request.guidance,
          steps: request.steps,
          sampler: request.sampler,
          seed: request.seed,
          format: request.format,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw httpError(response.status);
      const contentType = response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (!contentType || !["image/png", "image/jpeg", "image/webp"].includes(contentType))
        throw new AIProviderError(
          "DEZGO_IMAGE_INVALID",
          "Dezgo APIから画像以外の応答を受信しました。",
        );
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES)
        throw new AIProviderError(
          "DEZGO_IMAGE_TOO_LARGE",
          "Dezgo APIの生成画像が大きすぎます。",
        );
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length)
        throw new AIProviderError(
          "DEZGO_IMAGE_INVALID",
          "Dezgo APIの生成画像が空です。",
        );
      if (bytes.byteLength > MAX_IMAGE_BYTES)
        throw new AIProviderError(
          "DEZGO_IMAGE_TOO_LARGE",
          "Dezgo APIの生成画像が大きすぎます。",
        );
      const numberHeader = (name: string) => {
        const value = response.headers.get(name);
        if (value === null || value.trim() === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      };
      const metadata: DezgoGenerationMetadata = {
        seed: numberHeader("x-input-seed"),
        actualCostUsd: numberHeader("x-dezgo-job-amount-usd"),
        balanceUsd: numberHeader("x-dezgo-balance-total-usd"),
        balanceIndex: numberHeader("x-dezgo-balance-index"),
      };
      const extension =
        contentType === "image/jpeg"
          ? "jpg"
          : contentType === "image/webp"
            ? "webp"
            : "png";
      return {
        providerJobId: crypto.randomUUID(),
        images: [
          {
            fileName: `dezgo-${metadata.seed ?? "random"}.${extension}`,
            bytes,
            mimeType: contentType,
          },
        ],
        metadata,
        raw: metadata,
      };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (signal?.aborted)
        throw new AIProviderError(
          "DEZGO_CANCELED",
          "Dezgo APIへの生成要求をキャンセルしました。",
        );
      if (timedOut)
        throw new AIProviderError(
          "DEZGO_TIMEOUT",
          "Dezgo APIへの生成要求がタイムアウトしました。",
        );
      throw new AIProviderError(
        "DEZGO_CONNECTION_FAILED",
        "Dezgo APIへ接続できません。接続を確認してください。",
        true,
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  }
}

export class DezgoProvider implements ImageGenerationProvider {
  readonly id = "dezgo";
  readonly name = "Dezgo API";
  private readonly client: DezgoClient;

  constructor(
    getApiKey: () => Promise<string | null>,
    options: {
      fetchImpl?: typeof fetch;
      timeoutMs?: number;
      generationTimeoutMs?: number;
    } = {},
  ) {
    this.client = new DezgoClient(
      getApiKey,
      options.fetchImpl,
      options.timeoutMs,
      options.generationTimeoutMs,
    );
  }

  async checkConnection(
    signal?: AbortSignal,
  ): Promise<ProviderConnectionResult> {
    const startedAt = Date.now();
    try {
      await Promise.all([
        this.client.info(signal),
        this.client.balance(signal),
      ]);
      return {
        ok: true,
        message: "Dezgo APIへ接続できました。",
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Dezgo APIへ接続できません。",
      };
    }
  }

  async listModels(
    signal?: AbortSignal,
  ): Promise<ImageGenerationModelMetadata[]> {
    const fetchedAt = new Date().toISOString();
    const info = await this.client.info(signal);
    return (info.models ?? []).map((model) => ({
      id: model.id,
      name: model.name,
      family: model.family ?? undefined,
      description: model.description ?? undefined,
      license: model.license ?? undefined,
      categories: model.categories ?? undefined,
      supportedFunctions: Array.from(
        new Set(
          (model.functions ?? [])
            .map((value) => functionMap[value])
            .filter((value): value is ImageGenerationJobType => Boolean(value)),
        ),
      ),
      nativeResolution: model.nativeResolution ?? undefined,
      triggers: model.triggers,
      fetchedAt,
    }));
  }

  getBalance(signal?: AbortSignal) {
    return this.client.balance(signal);
  }

  async generateImage(): Promise<ImageGenerationResult> {
    throw new AIProviderError(
      "DEZGO_GENERATION_DISABLED",
      "Dezgo画像生成はまだ有効化されていません。",
    );
  }
}
