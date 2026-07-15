import {
  AIProviderError,
  type ImageGenerationProvider,
  type ImageGenerationRequest,
  type ImageGenerationResult,
  type ProviderConnectionResult,
  type ProviderJobStatus,
  type ProviderSettings,
} from "@mangai/ai-core";
import { fetchWithTimeout, safeBaseUrl } from "./http.js";
export class ComfyUIProvider implements ImageGenerationProvider {
  id = "comfyui";
  name = "ComfyUI";
  constructor(
    private settings: ProviderSettings,
    private getWorkflow: (
      id: string,
    ) => Promise<{ workflow: Record<string, any>; mapping: any }>,
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
      };
    set(definition.mapping.prompt, request.prompt);
    set(definition.mapping.negativePrompt, request.negativePrompt ?? "");
    set(definition.mapping.width, request.width);
    set(definition.mapping.height, request.height);
    set(definition.mapping.seed, request.seed);
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
