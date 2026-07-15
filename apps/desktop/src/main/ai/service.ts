import fs from "node:fs";
import path from "node:path";
import {
  AIProviderError,
  type ProviderSettings,
  type TextGenerationProvider,
  type ImageGenerationRequest,
} from "@mangai/ai-core";
import { MangaiDatabase } from "../database.js";
import { OllamaProvider } from "./providers/ollama.js";
import { MockTextProvider } from "./providers/mock.js";
import { ComfyUIProvider } from "./providers/comfyui.js";

export type ChatEvent = {
  requestId: string;
  sessionId: string;
  type: "start" | "chunk" | "complete" | "error" | "canceled";
  text?: string;
  jobId?: string;
  message?: string;
};
export class AIService {
  private controllers = new Map<string, AbortController>();
  private allowMock: boolean;
  constructor(
    private store: MangaiDatabase,
    options: { allowMock?: boolean } = {},
  ) {
    this.allowMock =
      options.allowMock ?? process.env.MANGAI_ENABLE_MOCK_AI === "true";
  }
  isMockEnabled() {
    return this.allowMock;
  }
  private log(
    event: string,
    error: unknown,
    details: Record<string, unknown> = {},
  ) {
    try {
      fs.mkdirSync(this.store.paths.logs, { recursive: true });
      fs.appendFileSync(
        path.join(this.store.paths.logs, "ai.log"),
        JSON.stringify({
          at: new Date().toISOString(),
          event,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          ...details,
        }) + "\n",
        "utf8",
      );
    } catch {
      // Logging failures must never stop project or AI operations.
    }
  }
  private settings(id: string) {
    const value = this.store
      .getProviderSettings()
      .find((item) => item.providerId === id);
    if (!value)
      throw new AIProviderError(
        "PROVIDER_NOT_CONFIGURED",
        "AIプロバイダーが設定されていません。",
      );
    return value;
  }
  private textProvider(): {
    provider: TextGenerationProvider;
    settings: ProviderSettings;
  } {
    const ollama = this.settings("ollama");
    if (ollama.enabled)
      return { provider: new OllamaProvider(ollama), settings: ollama };
    if (!this.allowMock)
      throw new AIProviderError(
        "PROVIDER_NOT_CONFIGURED",
        "AIが設定されていません。設定画面でOllamaを有効にしてください。",
      );
    const mock = this.settings("mock");
    if (!mock.enabled)
      throw new AIProviderError(
        "PROVIDER_NOT_CONFIGURED",
        "AIが設定されていません。設定画面でOllamaを有効にしてください。",
      );
    return { provider: new MockTextProvider(), settings: mock };
  }
  provider(id: "ollama" | "comfyui" | "mock") {
    const settings = this.settings(id);
    if (id === "ollama") return new OllamaProvider(settings);
    if (id === "comfyui")
      return new ComfyUIProvider(settings, async (workflowId) =>
        this.store.getComfyWorkflow(workflowId),
      );
    if (!this.allowMock)
      throw new AIProviderError(
        "PROVIDER_DISABLED",
        "製品版ではMock AIを利用できません。",
      );
    return new MockTextProvider();
  }
  cancel(requestId: string) {
    this.controllers.get(requestId)?.abort();
  }
  async sendChat(
    input: {
      requestId: string;
      sessionId?: string;
      projectId?: string;
      episodeId?: string;
      pageId?: string;
      message: string;
      templateId?: string;
      includeContext: boolean;
    },
    emit: (event: ChatEvent) => void,
  ) {
    const controller = new AbortController();
    this.controllers.set(input.requestId, controller);
    let sessionId = input.sessionId;
    let jobId: string | undefined;
    try {
      if (!sessionId)
        sessionId = this.store.createChatSession(
          input.projectId,
          input.message.slice(0, 40),
        );
      this.store.addChatMessage(sessionId, "user", input.message);
      const templates = this.store.listPromptTemplates() as any[],
        template = templates.find((item) => item.id === input.templateId);
      const context =
        input.includeContext && input.projectId
          ? this.store.projectContext(
              input.projectId,
              input.episodeId,
              input.pageId,
            )
          : undefined;
      const prompt = [
        template?.template,
        context?.summary &&
          `以下はユーザーが送信を許可したプロジェクト情報です。\n${context.summary}`,
        input.message,
      ]
        .filter(Boolean)
        .join("\n\n");
      const { provider, settings } = this.textProvider(),
        model = settings.modelId || "mock-text";
      jobId = this.store.createGenerationJob({
        projectId: input.projectId,
        episodeId: input.episodeId,
        pageId: input.pageId,
        providerType: "text",
        providerId: provider.id,
        modelId: model,
        generationType: "chat",
        prompt,
        inputJson: { sessionId, includeContext: input.includeContext },
      });
      this.store.updateGenerationJob(jobId, "running");
      emit({ requestId: input.requestId, sessionId, type: "start", jobId });
      let text = "";
      if (settings.stream && provider.streamText) {
        for await (const chunk of provider.streamText(
          {
            model,
            prompt,
            systemPrompt: template?.systemPrompt,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            stream: true,
          },
          context,
          controller.signal,
        )) {
          text += chunk.text;
          emit({
            requestId: input.requestId,
            sessionId,
            type: "chunk",
            text: chunk.text,
            jobId,
          });
        }
      } else {
        const result = await provider.generateText(
          {
            model,
            prompt,
            systemPrompt: template?.systemPrompt,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
          },
          context,
          controller.signal,
        );
        text = result.text;
        emit({
          requestId: input.requestId,
          sessionId,
          type: "chunk",
          text,
          jobId,
        });
      }
      if (controller.signal.aborted) {
        this.store.updateGenerationJob(jobId, "canceled");
        emit({
          requestId: input.requestId,
          sessionId,
          type: "canceled",
          jobId,
        });
        return;
      }
      this.store.addChatMessage(
        sessionId,
        "assistant",
        text,
        provider.id,
        model,
      );
      this.store.updateGenerationJob(jobId, "completed", { output: { text } });
      emit({
        requestId: input.requestId,
        sessionId,
        type: "complete",
        text,
        jobId,
      });
    } catch (error) {
      const canceled = controller.signal.aborted,
        message =
          error instanceof Error ? error.message : "AI生成に失敗しました。";
      if (jobId)
        this.store.updateGenerationJob(
          jobId,
          canceled ? "canceled" : "failed",
          {
            errorCode:
              error instanceof AIProviderError ? error.code : "UNKNOWN",
            errorMessage: message,
          },
        );
      this.log("chat_generation_failed", error, {
        provider: this.textProvider().provider.id,
        jobId,
      });
      emit({
        requestId: input.requestId,
        sessionId: sessionId ?? "",
        type: canceled ? "canceled" : "error",
        message,
      });
    } finally {
      this.controllers.delete(input.requestId);
    }
  }
  async generateImage(input: {
    projectId: string;
    episodeId?: string;
    pageId?: string;
    workflowId: string;
    prompt: string;
    negativePrompt: string;
    width?: number;
    height?: number;
    seed?: number;
  }) {
    const settings = this.settings("comfyui");
    if (!settings.enabled)
      throw new AIProviderError(
        "PROVIDER_DISABLED",
        "ComfyUIが無効です。設定画面で有効にしてください。",
      );
    const provider = new ComfyUIProvider(settings, async (id) =>
        this.store.getComfyWorkflow(id),
      ),
      jobId = this.store.createGenerationJob({
        projectId: input.projectId,
        episodeId: input.episodeId,
        pageId: input.pageId,
        providerType: "image",
        providerId: "comfyui",
        generationType: "image",
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        inputJson: input,
      });
    const controller = new AbortController();
    this.controllers.set(jobId, controller);
    try {
      this.store.updateGenerationJob(jobId, "running", { progress: 0.05 });
      const queued = await provider.generateImage(
        input as ImageGenerationRequest,
        undefined,
        controller.signal,
      );
      this.store.updateGenerationJob(jobId, "running", {
        providerJobId: queued.providerJobId,
        progress: 0.15,
      });
      const deadline = Date.now() + settings.timeoutMs;
      while (Date.now() < deadline) {
        if (controller.signal.aborted) {
          await provider.cancelJob?.(queued.providerJobId);
          this.store.updateGenerationJob(jobId, "canceled");
          return { jobId, status: "canceled" };
        }
        const status = await provider.getJobStatus!(
          queued.providerJobId,
          controller.signal,
        );
        if (status.status === "failed")
          throw new AIProviderError(
            "GENERATION_FAILED",
            status.error ?? "ComfyUI生成に失敗しました。",
          );
        if (status.status === "completed") {
          this.store.updateGenerationJob(jobId, "running", { progress: 0.9 });
          const images = await provider.downloadImages(
              queued.providerJobId,
              status.outputs,
              controller.signal,
            ),
            project = this.store.bundle(input.projectId).project,
            dir = path.join(project.storagePath, "generated", "images", jobId);
          fs.mkdirSync(dir, { recursive: true });
          const createdAssetIds: string[] = [];
          try {
            for (const image of images) {
              const safe =
                  image.fileName.replace(/[^a-zA-Z0-9._-]/g, "-") ||
                  "generated.png",
                file = path.join(dir, safe);
              fs.writeFileSync(file, image.bytes);
              const registered = this.store.registerGeneratedAsset(
                input.projectId,
                path.relative(project.storagePath, file),
                jobId,
                {
                  provider: "comfyui",
                  workflowId: input.workflowId,
                  prompt: input.prompt,
                  negativePrompt: input.negativePrompt,
                  width: input.width,
                  height: input.height,
                  seed: input.seed,
                  createdAt: new Date().toISOString(),
                },
              );
              if (registered.created)
                createdAssetIds.push(registered.assetId);
            }
            this.store.updateGenerationJob(jobId, "completed", {
              output: { count: images.length },
            });
            this.store.recordCreatedAssetsHistory(
              input.projectId,
              "AI生成素材を追加",
              createdAssetIds,
            );
          } catch (error) {
            for (const assetId of createdAssetIds.reverse()) {
              try {
                this.store.deleteAsset(assetId);
              } catch {
                // 元の生成エラーを優先する。
              }
            }
            throw error;
          }
          return {
            jobId,
            status: "completed",
            count: images.length,
            bundle: this.store.bundle(input.projectId),
          };
        }
        this.store.updateGenerationJob(jobId, "running", {
          progress: status.progress ?? 0.5,
        });
        await new Promise((resolve) =>
          setTimeout(resolve, settings.pollIntervalMs),
        );
      }
      throw new AIProviderError(
        "TIMEOUT",
        "ComfyUI画像生成がタイムアウトしました。",
      );
    } catch (error) {
      this.log("image_generation_failed", error, {
        provider: "comfyui",
        jobId,
      });
      this.store.updateGenerationJob(
        jobId,
        controller.signal.aborted ? "canceled" : "failed",
        {
          errorCode: error instanceof AIProviderError ? error.code : "UNKNOWN",
          errorMessage:
            error instanceof Error ? error.message : "画像生成に失敗しました。",
        },
      );
      if (controller.signal.aborted) return { jobId, status: "canceled" };
      throw error;
    } finally {
      this.controllers.delete(jobId);
    }
  }
}
