import {
  AIProviderError,
  type ImageGenerationProvider,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type GenerationInputImage,
  type ProviderConnectionResult,
  type ProviderJobStatus,
  type ProviderSettings,
  type RuntimeProfileState,
  type ComfyLowSpecRuntimeReport,
} from "@mangai/ai-core";
import { fetchWithTimeout, safeBaseUrl } from "./http.js";
export function applyRuntimeLimitsToWorkflow(
  workflow: Record<string, any>,
  runtime: RuntimeProfileState,
) {
  const classTypes: string[] = [];
  for (const node of Object.values(workflow)) {
    if (!node || typeof node !== "object") continue;
    if (typeof node.class_type === "string")
      classTypes.push(node.class_type.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (
      node.inputs &&
      typeof node.inputs === "object" &&
      Object.hasOwn(node.inputs, "batch_size")
    )
      node.inputs.batch_size = runtime.limits.batchSize;
  }
  const controlNetLoaders = classTypes.filter((value) =>
      value.includes("controlnetloader"),
    ).length,
    controlNetAppliers = classTypes.filter((value) =>
      value.includes("controlnetapply"),
    ).length,
    controlNets = Math.max(controlNetLoaders, controlNetAppliers),
    loras = classTypes.filter((value) => value.includes("loraloader")).length;
  if (controlNets > runtime.limits.maxControlNets)
    throw new AIProviderError(
      "WORKFLOW_PROFILE_LIMIT",
      `現在のRuntime ProfileではControlNetは最大${runtime.limits.maxControlNets}件です。ワークフローには${controlNets}件あります。`,
    );
  if (loras > runtime.limits.maxLoras)
    throw new AIProviderError(
      "WORKFLOW_PROFILE_LIMIT",
      `現在のRuntime ProfileではLoRAは最大${runtime.limits.maxLoras}件です。ワークフローには${loras}件あります。`,
    );
  return { controlNets, loras };
}

export class ComfyUIProvider implements ImageGenerationProvider {
  id = "comfyui";
  name = "ComfyUI";
  constructor(
    private settings: ProviderSettings,
    private getWorkflow: (
      id: string,
    ) => Promise<{ workflow: Record<string, any>; mapping: any }>,
    private getRuntimeProfile?: () => RuntimeProfileState,
  ) {}
  private url(path: string) {
    return `${safeBaseUrl(this.settings.baseUrl, this.settings.allowedOrigins)}${path}`;
  }
  async checkConnection(
    signal?: AbortSignal,
  ): Promise<ProviderConnectionResult> {
    const start = Date.now();
    try {
      const response = await fetchWithTimeout(
        this.url("/system_stats"),
        {},
        this.settings.timeoutMs,
        signal,
      );
      return response.ok
        ? {
            ok: true,
            message: "ComfyUIへ接続できました。",
            latencyMs: Date.now() - start,
          }
        : {
            ok: false,
            message: `ComfyUIがHTTP ${response.status}を返しました。`,
          };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "ComfyUIへ接続できません。",
      };
    }
  }
  async inspectLowSpecRuntime(
    signal?: AbortSignal,
  ): Promise<ComfyLowSpecRuntimeReport> {
    const [statsResponse, tiledNodeResponse] = await Promise.all([
      fetchWithTimeout(
        this.url("/system_stats"),
        {},
        this.settings.timeoutMs,
        signal,
      ),
      fetchWithTimeout(
        this.url("/object_info/VAEDecodeTiled"),
        {},
        this.settings.timeoutMs,
        signal,
      ),
    ]);
    if (!statsResponse.ok)
      throw new AIProviderError(
        "CONNECTION_FAILED",
        `ComfyUI実行環境の取得に失敗しました（HTTP ${statsResponse.status}）。`,
      );
    if (!tiledNodeResponse.ok)
      throw new AIProviderError(
        "NODE_INFO_FAILED",
        `ComfyUIノード情報の取得に失敗しました（HTTP ${tiledNodeResponse.status}）。`,
      );
    const stats = (await statsResponse.json()) as Record<string, any>,
      tiledNodes = (await tiledNodeResponse.json()) as Record<string, any>,
      argv = Array.isArray(stats.system?.argv)
        ? stats.system.argv.map(String)
        : [],
      hasFlag = (name: string) =>
        argv.some((value: string) => value === name || value.startsWith(`${name}=`)),
      flagValue = (name: string) => {
        const inline = argv.find((value: string) => value.startsWith(`${name}=`));
        if (inline) return inline.slice(name.length + 1);
        const index = argv.indexOf(name);
        return index >= 0 ? argv[index + 1] : undefined;
      },
      cpuVaeEnabled = hasFlag("--cpu-vae"),
      dynamicVramEnabled = !hasFlag("--disable-dynamic-vram"),
      lowVramMode = hasFlag("--novram")
        ? "novram"
        : hasFlag("--lowvram")
          ? "lowvram"
          : dynamicVramEnabled
            ? "dynamic"
            : "disabled",
      reserve = Number(flagValue("--reserve-vram")),
      devices = (Array.isArray(stats.devices) ? stats.devices : []).map(
        (device: Record<string, unknown>) => ({
          name: String(device.name ?? ""),
          type: String(device.type ?? ""),
          vramTotalBytes:
            typeof device.vram_total === "number" ? device.vram_total : null,
          vramFreeBytes:
            typeof device.vram_free === "number" ? device.vram_free : null,
        }),
      ),
      tiledVaeNodeAvailable = Boolean(tiledNodes.VAEDecodeTiled),
      hasAccelerator = devices.some(
        (device) => device.type && device.type.toLowerCase() !== "cpu",
      );
    return {
      comfyuiVersion:
        typeof stats.system?.comfyui_version === "string"
          ? stats.system.comfyui_version
          : null,
      devices,
      tiledVaeNodeAvailable,
      cpuVaeEnabled,
      lowVramMode,
      dynamicVramEnabled,
      reserveVramGb: Number.isFinite(reserve) ? reserve : null,
      runtimeChecksPassed:
        tiledVaeNodeAvailable && cpuVaeEnabled && hasAccelerator,
    };
  }
  private async uploadInputImage(
    image: GenerationInputImage,
    signal?: AbortSignal,
  ) {
    const safeName =
        image.fileName.replace(/[^a-zA-Z0-9._-]/g, "-") || "input.png",
      form = new FormData();
    form.append(
      "image",
      new Blob([new Uint8Array(image.bytes)], { type: image.mimeType }),
      safeName,
    );
    form.append("type", "input");
    form.append("overwrite", "false");
    const response = await fetchWithTimeout(
      this.url("/upload/image"),
      { method: "POST", body: form },
      this.settings.timeoutMs,
      signal,
    );
    if (!response.ok)
      throw new AIProviderError(
        "INPUT_UPLOAD_FAILED",
        "ComfyUIへ入力画像を渡せませんでした。",
      );
    const result = (await response.json()) as { name?: unknown };
    if (typeof result.name !== "string" || !result.name)
      throw new AIProviderError(
        "INPUT_UPLOAD_INVALID",
        "ComfyUIの入力画像応答を確認できませんでした。",
      );
    return result.name;
  }
  async generateImage(
    request: ImageGenerationRequest,
    _context?: unknown,
    signal?: AbortSignal,
  ): Promise<ImageGenerationResult> {
    const definition = await this.getWorkflow(request.workflowId),
      workflow = structuredClone(definition.workflow),
      set = (target: any, value: unknown) => {
        if (!target || value === undefined) return;
        const node = workflow[target.nodeId];
        if (!node?.inputs || !(target.input in node.inputs))
          throw new AIProviderError(
            "WORKFLOW_MAPPING_INVALID",
            `ワークフローのノード ${target.nodeId}.${target.input} が見つかりません。`,
          );
        node.inputs[target.input] = value;
      },
      requireMapping = (field: string, target: any) => {
        if (!target)
          throw new AIProviderError(
            "WORKFLOW_MAPPING_REQUIRED",
            `この生成モードには${field}マッピングが必要です。`,
          );
        return target;
      };
    set(definition.mapping.prompt, request.prompt);
    set(definition.mapping.negativePrompt, request.negativePrompt ?? "");
    set(definition.mapping.width, request.width);
    set(definition.mapping.height, request.height);
    set(definition.mapping.seed, request.seed);
    if (this.getRuntimeProfile)
      applyRuntimeLimitsToWorkflow(workflow, this.getRuntimeProfile());
    const operation = request.operation ?? "text_to_image";
    if (operation !== "text_to_image") {
      if (!request.inputImage)
        throw new AIProviderError(
          "INPUT_IMAGE_REQUIRED",
          "この生成モードには入力画像が必要です。",
        );
      const inputTarget = requireMapping(
          operation === "controlnet" ? "ControlNet画像" : "入力画像",
          operation === "controlnet"
            ? definition.mapping.controlImage
            : definition.mapping.sourceImage,
        ),
        inputName = await this.uploadInputImage(request.inputImage, signal);
      set(inputTarget, inputName);
      set(definition.mapping.denoiseStrength, request.denoiseStrength);
    }
    if (operation === "inpainting") {
      if (!request.maskImage)
        throw new AIProviderError(
          "MASK_IMAGE_REQUIRED",
          "Inpaintingにはマスク画像が必要です。",
        );
      const maskTarget = requireMapping(
          "マスク画像",
          definition.mapping.maskImage,
        ),
        maskName = await this.uploadInputImage(request.maskImage, signal);
      set(maskTarget, maskName);
    }
    const response = await fetchWithTimeout(
      this.url("/prompt"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: workflow,
          client_id: crypto.randomUUID(),
        }),
      },
      this.settings.timeoutMs,
      signal,
    );
    if (!response.ok)
      throw new AIProviderError(
        "QUEUE_FAILED",
        "ComfyUIキューへの送信に失敗しました。",
      );
    const queued = (await response.json()) as {
      prompt_id?: string;
      error?: unknown;
    };
    if (!queued.prompt_id)
      throw new AIProviderError(
        "WORKFLOW_INVALID",
        `ComfyUIワークフローが拒否されました: ${JSON.stringify(queued.error ?? {})}`,
      );
    return { providerJobId: queued.prompt_id, images: [], raw: queued };
  }
  async getJobStatus(
    id: string,
    signal?: AbortSignal,
  ): Promise<ProviderJobStatus> {
    const response = await fetchWithTimeout(
      this.url(`/history/${encodeURIComponent(id)}`),
      {},
      this.settings.timeoutMs,
      signal,
    );
    if (!response.ok)
      throw new AIProviderError(
        "STATUS_FAILED",
        "ComfyUIの生成状態を取得できませんでした。",
      );
    const history = (await response.json()) as Record<string, any>,
      entry = history[id];
    if (!entry) return { status: "running" };
    if (entry.status?.status_str === "error")
      return {
        status: "failed",
        error: "ComfyUI生成に失敗しました。",
        outputs: entry,
      };
    return { status: "completed", progress: 1, outputs: entry.outputs };
  }
  async downloadImages(id: string, outputs: any, signal?: AbortSignal) {
    const result: Array<{
      fileName: string;
      bytes: Uint8Array;
      mimeType: string;
    }> = [];
    for (const output of Object.values(outputs ?? {}) as any[]) {
      for (const image of output.images ?? []) {
        const query = new URLSearchParams({
          filename: image.filename,
          subfolder: image.subfolder ?? "",
          type: image.type ?? "output",
        });
        const response = await fetchWithTimeout(
          this.url(`/view?${query}`),
          {},
          this.settings.timeoutMs,
          signal,
        );
        if (!response.ok)
          throw new AIProviderError(
            "IMAGE_FETCH_FAILED",
            "ComfyUIの生成画像を取得できませんでした。",
          );
        result.push({
          fileName: image.filename,
          bytes: new Uint8Array(await response.arrayBuffer()),
          mimeType: response.headers.get("content-type") ?? "image/png",
        });
      }
    }
    return result;
  }
  async cancelJob(_id: string) {
    void _id;
    await fetchWithTimeout(
      this.url("/interrupt"),
      { method: "POST" },
      this.settings.timeoutMs,
    );
  }
}
