import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  AIProviderError,
  createExternalDispatchPreview,
  constrainImageDimensions,
  imageJobRequestSchema,
  isGenerationQueueWindowOpen,
  minutesUntilGenerationQueueWindow,
  routeGenerationJob,
  type SafeAssetLibraryRequest,
  type SafeAssetJobType,
  type RouteDecision,
  type ProviderSettings,
  type TextGenerationProvider,
  type ImageGenerationRequest,
  type ImageJobRequest,
  type PageBatchImageRequest,
  type GenerationQueueSettings,
  type RuntimeProfileState,
} from "@mangai/ai-core";
import { MangaiDatabase } from "../database.js";
import { OllamaProvider } from "./providers/ollama.js";
import { MockTextProvider } from "./providers/mock.js";
import { ComfyUIProvider } from "./providers/comfyui.js";
import { DezgoProvider } from "./providers/dezgo.js";
import type { DezgoFeatureFlags } from "./dezgo-feature-flags.js";

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
  private activeLocalImageJobId: string | null = null;
  private activeLocalTextRequests = new Set<string>();
  private pauseRequested = new Set<string>();
  private queueWakeTimer: NodeJS.Timeout | undefined;
  private allowMock: boolean;
  private getRuntimeProfile?: () => RuntimeProfileState;
  private retryBaseDelayMs: number;
  private getProviderCredential: (
    providerId: "dezgo",
  ) => Promise<string | null>;
  private dezgoFeatures: DezgoFeatureFlags;
  constructor(
    private store: MangaiDatabase,
    options: {
      allowMock?: boolean;
      getRuntimeProfile?: () => RuntimeProfileState;
      retryBaseDelayMs?: number;
      getProviderCredential?: (providerId: "dezgo") => Promise<string | null>;
      dezgoFeatures?: DezgoFeatureFlags;
    } = {},
  ) {
    this.allowMock =
      options.allowMock ?? process.env.MANGAI_ENABLE_MOCK_AI === "true";
    this.getRuntimeProfile = options.getRuntimeProfile;
    this.retryBaseDelayMs = Math.max(10, options.retryBaseDelayMs ?? 1000);
    this.getProviderCredential =
      options.getProviderCredential ?? (async () => null);
    this.dezgoFeatures = options.dezgoFeatures ?? {
      dezgoProviderEnabled: false,
      dezgoDirectByokEnabled: false,
      dezgoAdultGenerationEnabled: false,
      dezgoBatchGenerationEnabled: false,
    };
  }
  isMockEnabled() {
    return this.allowMock;
  }
  private isLoopbackUrl(baseUrl: string) {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "[::1]" ||
      hostname === "::1" ||
      /^127(?:\.\d{1,3}){3}$/.test(hostname)
    );
  }
  private async unloadLocalTextModel(signal: AbortSignal) {
    const settings = this.settings("ollama");
    if (
      !settings.enabled ||
      !settings.modelId ||
      !this.isLoopbackUrl(settings.baseUrl)
    )
      return false;
    await new OllamaProvider(settings).unloadModel(settings.modelId, signal);
    return true;
  }
  private routeImageGeneration(
    jobId: string,
    input: {
      projectId: string;
      pageId?: string;
      prompt: string;
      jobType?: SafeAssetJobType;
    },
    settings: ProviderSettings,
  ): { decision: RouteDecision; localProvider: boolean } {
    const policy = this.store.getProjectGenerationPolicy(input.projectId);
    const localProvider = this.isLoopbackUrl(settings.baseUrl);
    const draft = input.jobType
      ? {
          projectId: input.projectId,
          pageId: input.pageId,
          type: input.jobType,
          sensitivity: "safe" as const,
          inputAssetIds: [],
          personPresence: "none" as const,
          hasCharacterReference: false,
          hasCompletedPage: false,
          promptIncludesRestrictedContent: false,
          allInputAssetsExternalAllowed: true,
        }
      : {
          projectId: input.projectId,
          pageId: input.pageId,
          type: "adult_character_render" as const,
          sensitivity: "external_forbidden" as const,
          inputAssetIds: [],
          personPresence: "unknown" as const,
          hasCharacterReference: false,
          hasCompletedPage: false,
          promptIncludesRestrictedContent: false,
          allInputAssetsExternalAllowed: false,
        };
    const context = {
      policy: policy.externalProcessingPolicy,
      availableTargets: [
        "builtin" as const,
        localProvider ? ("local" as const) : ("cloud" as const),
      ],
      preferLocal: policy.preferLocal,
      externalProviderEnabled: settings.enabled && !localProvider,
      // 外部Providerの費用見積もりが未実装の間は上限内とみなさない。
      externalCostWithinLimit: false,
      requireExternalConfirmation: policy.externalConfirmationRequired,
      manualApprovalGranted: false,
      customCloudJobTypes: policy.customCloudJobTypes,
      sensitiveRenderNodeAllowed: false,
      cloudProviderId: localProvider ? undefined : "comfyui",
    };
    const decision = routeGenerationJob(draft, context);
    this.store.createGenerationRouteDecision({
      jobId,
      projectId: input.projectId,
      draft,
      context,
      decision,
      promptSha256: crypto
        .createHash("sha256")
        .update(input.prompt, "utf8")
        .digest("hex"),
    });
    return { decision, localProvider };
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
  resolveSafeAssetLibrary(input: SafeAssetLibraryRequest) {
    if (
      input.pageId &&
      this.store.projectIdForPage(input.pageId) !== input.projectId
    )
      throw new Error("PageとProjectの参照が一致しません。");
    const policy = this.store.getProjectGenerationPolicy(input.projectId);
    const queryTokens = input.query
      .toLocaleLowerCase("ja-JP")
      .split(/[\s,、]+/)
      .filter(Boolean);
    const matches = this.store
      .bundle(input.projectId)
      .assets.filter((asset) => {
        if (asset.libraryCategory !== input.type) return false;
        const searchable = [asset.fileName, ...asset.libraryTags]
          .join(" ")
          .toLocaleLowerCase("ja-JP");
        return queryTokens.every((token) => searchable.includes(token));
      })
      .sort(
        (left, right) =>
          Number(right.libraryFavorite) - Number(left.libraryFavorite) ||
          right.createdAt.localeCompare(left.createdAt),
      )
      .slice(0, 20);
    const comfy = this.store
      .getProviderSettings()
      .find((settings) => settings.providerId === "comfyui");
    const localAvailable = Boolean(
      comfy?.enabled && this.isLoopbackUrl(comfy.baseUrl),
    );
    const draft = {
      projectId: input.projectId,
      pageId: input.pageId,
      type: input.type,
      sensitivity: "safe" as const,
      inputAssetIds: [],
      personPresence: "none" as const,
      hasCharacterReference: false,
      hasCompletedPage: false,
      promptIncludesRestrictedContent: false,
      allInputAssetsExternalAllowed: true,
    };
    const context = {
      policy: policy.externalProcessingPolicy,
      availableTargets: [
        "builtin" as const,
        ...(matches.length ? (["asset_library"] as const) : []),
        ...(localAvailable ? (["local"] as const) : []),
      ],
      preferLocal: policy.preferLocal,
      externalProviderEnabled: false,
      externalCostWithinLimit: false,
      requireExternalConfirmation: policy.externalConfirmationRequired,
      manualApprovalGranted: false,
      customCloudJobTypes: policy.customCloudJobTypes,
      sensitiveRenderNodeAllowed: false,
    };
    const decision = routeGenerationJob(draft, context);
    const jobId = this.store.createGenerationJob({
      projectId: input.projectId,
      pageId: input.pageId,
      providerType: "asset",
      providerId: "asset_library",
      generationType: input.type,
      prompt: input.query,
      inputJson: input,
    });
    this.store.createGenerationRouteDecision({
      jobId,
      projectId: input.projectId,
      draft,
      context,
      decision,
      promptSha256: crypto
        .createHash("sha256")
        .update(input.query, "utf8")
        .digest("hex"),
    });
    if (decision.target === "asset_library" && matches.length) {
      this.store.updateGenerationJob(jobId, "completed", {
        output: { assetIds: matches.map((asset) => asset.id) },
      });
      return { jobId, status: "completed" as const, decision, assets: matches };
    }
    const message = decision.blocked
      ? "一致する素材がなく、利用可能なローカル生成先もありません。"
      : "一致する素材がありません。ローカル生成を使用してください。";
    this.store.updateGenerationJob(jobId, "failed", {
      errorCode: decision.blocked ? "ROUTE_BLOCKED" : "ASSET_LIBRARY_NO_MATCH",
      errorMessage: message,
    });
    return { jobId, status: "failed" as const, decision, assets: [], message };
  }
  previewExternalSafeAsset(input: SafeAssetLibraryRequest) {
    if (
      input.pageId &&
      this.store.projectIdForPage(input.pageId) !== input.projectId
    )
      throw new Error("PageとProjectの参照が一致しません。");
    const policy = this.store.getProjectGenerationPolicy(input.projectId);
    return createExternalDispatchPreview({
      previewId: crypto.randomUUID(),
      request: input,
      promptSha256: crypto
        .createHash("sha256")
        .update(input.query, "utf8")
        .digest("hex"),
      policy: policy.externalProcessingPolicy,
      customCloudJobTypes: policy.customCloudJobTypes,
      createdAt: new Date().toISOString(),
    });
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
  provider(id: "ollama" | "comfyui" | "mock" | "dezgo") {
    if (id === "dezgo") {
      if (
        !this.dezgoFeatures.dezgoProviderEnabled ||
        !this.dezgoFeatures.dezgoDirectByokEnabled
      )
        throw new AIProviderError(
          "DEZGO_DISABLED",
          "Dezgo APIはこのビルドで無効です。",
        );
      return new DezgoProvider(() => this.getProviderCredential("dezgo"));
    }
    const settings = this.settings(id);
    if (id === "ollama") return new OllamaProvider(settings);
    if (id === "comfyui")
      return new ComfyUIProvider(
        settings,
        async (workflowId) => this.store.getComfyWorkflow(workflowId),
        this.getRuntimeProfile,
      );
    if (!this.allowMock)
      throw new AIProviderError(
        "PROVIDER_DISABLED",
        "製品版ではMock AIを利用できません。",
      );
    return new MockTextProvider();
  }
  inspectComfyLowSpecRuntime() {
    const settings = this.settings("comfyui");
    if (!settings.enabled)
      throw new AIProviderError(
        "PROVIDER_DISABLED",
        "ComfyUIが無効です。設定画面で有効にしてください。",
      );
    return new ComfyUIProvider(
      settings,
      async (workflowId) => this.store.getComfyWorkflow(workflowId),
      this.getRuntimeProfile,
    ).inspectLowSpecRuntime();
  }
  cancel(requestId: string) {
    const controller = this.controllers.get(requestId);
    if (controller) controller.abort();
    else {
      const job = this.store.getGenerationJob(requestId);
      if (job && ["queued", "paused"].includes(String(job.status)))
        this.store.setGenerationJobStatus(requestId, "canceled");
    }
  }
  pauseImageJob(jobId: string) {
    const job = this.store.getGenerationJob(jobId);
    if (!job) return false;
    if (job.status === "running") {
      this.pauseRequested.add(jobId);
      this.controllers.get(jobId)?.abort();
      return true;
    }
    return job.status === "queued"
      ? this.store.setGenerationJobStatus(jobId, "paused")
      : false;
  }
  resumeImageJob(jobId: string) {
    const job = this.store.getGenerationJob(jobId);
    if (!job || job.status !== "paused") return false;
    const changed = this.store.setGenerationJobStatus(jobId, "queued");
    if (changed) void this.runNextQueuedImage();
    return changed;
  }
  changeImageJobPriority(jobId: string, delta: number) {
    return this.store.changeGenerationJobPriority(jobId, delta);
  }
  resumeQueuedImages() {
    void this.runNextQueuedImage();
  }
  getQueueSettings() {
    return this.store.getGenerationQueueSettings();
  }
  saveQueueSettings(input: unknown) {
    const settings = this.store.saveGenerationQueueSettings(input);
    if (this.queueWakeTimer) clearTimeout(this.queueWakeTimer);
    this.queueWakeTimer = undefined;
    void this.runNextQueuedImage();
    return settings;
  }

  enqueuePageBatch(input: PageBatchImageRequest) {
    const settings = this.settings("comfyui");
    if (!settings.enabled)
      throw new AIProviderError(
        "PROVIDER_DISABLED",
        "ComfyUIが無効です。設定画面で有効にしてください。",
      );
    this.store.getComfyWorkflow(input.workflowId);
    const bundle = this.store.bundle(input.projectId);
    const requested = new Set(input.pageIds);
    if (requested.size !== input.pageIds.length)
      throw new AIProviderError(
        "BATCH_PAGE_INVALID",
        "一括生成のPage IDが重複しています。",
      );
    const episodePages = bundle.pages
      .filter((page) => page.episodeId === input.episodeId)
      .sort((left, right) => left.orderIndex - right.orderIndex);
    const found = new Set(episodePages.map((page) => page.id));
    if (input.pageIds.some((id) => !found.has(id)))
      throw new AIProviderError(
        "BATCH_PAGE_INVALID",
        "一括生成対象に別Episodeまたは別ProjectのPageが含まれています。",
      );
    const pages = episodePages.filter((page) => requested.has(page.id));
    const eligible = pages.filter((page) => page.prompt.trim());
    const skippedPageIds = pages
      .filter((page) => !page.prompt.trim())
      .map((page) => page.id);
    if (!eligible.length)
      throw new AIProviderError(
        "BATCH_PROMPT_EMPTY",
        "Promptが入力されたPageがありません。",
      );
    const jobs = eligible.map((page) => {
      const request: ImageJobRequest = {
        projectId: input.projectId,
        episodeId: input.episodeId,
        pageId: page.id,
        workflowId: input.workflowId,
        prompt: page.prompt,
        negativePrompt: page.negativePrompt,
        width: page.width,
        height: page.height,
        seed: crypto.randomInt(0, 2_147_483_647),
      };
      return {
        pageId: page.id,
        jobId: this.store.createGenerationJob({
          projectId: request.projectId,
          episodeId: request.episodeId,
          pageId: request.pageId,
          providerType: "image",
          providerId: "comfyui",
          generationType: "image",
          prompt: request.prompt,
          negativePrompt: request.negativePrompt,
          inputJson: request,
        }),
      };
    });
    void this.runNextQueuedImage();
    return { jobs, queuedCount: jobs.length, skippedPageIds };
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
      const runtime = this.getRuntimeProfile?.();
      const usesLocalGpu =
        provider.id === "ollama" && this.isLoopbackUrl(settings.baseUrl);
      if (runtime?.limits.exclusiveGpuWork && usesLocalGpu) {
        if (this.activeLocalImageJobId || this.activeLocalTextRequests.size)
          throw new AIProviderError(
            "LOCAL_RESOURCE_BUSY",
            "低VRAM端末ではCreator Chatと画像生成を同時実行できません。実行中の処理が完了してから再試行してください。",
            true,
          );
        this.activeLocalTextRequests.add(input.requestId);
      }
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
      this.activeLocalTextRequests.delete(input.requestId);
      this.controllers.delete(input.requestId);
      void this.runNextQueuedImage();
    }
  }
  private async runNextQueuedImage() {
    const windowDelay = this.queueWindowDelayMs();
    if (windowDelay > 0) {
      this.scheduleQueueWake(windowDelay);
      return;
    }
    if (
      this.activeLocalImageJobId ||
      (this.getRuntimeProfile?.().limits.exclusiveGpuWork &&
        this.activeLocalTextRequests.size)
    )
      return;
    const next = this.store.nextQueuedImageJob();
    if (!next) {
      const delay = this.store.nextQueuedImageDelayMs();
      if (delay !== null) this.scheduleQueueWake(delay);
      return;
    }
    if (this.queueWakeTimer) clearTimeout(this.queueWakeTimer);
    this.queueWakeTimer = undefined;
    try {
      await this.generateImage(
        imageJobRequestSchema.parse(JSON.parse(next.inputJson)),
        next.id,
      );
    } catch {
      // runImageJob records the durable failure before rejecting.
    }
  }
  private scheduleQueueWake(delayMs: number) {
    if (this.queueWakeTimer) clearTimeout(this.queueWakeTimer);
    this.queueWakeTimer = setTimeout(() => {
      this.queueWakeTimer = undefined;
      void this.runNextQueuedImage();
    }, Math.max(10, delayMs));
    this.queueWakeTimer.unref?.();
  }
  private queueWindowDelayMs(settings?: GenerationQueueSettings) {
    const queueSettings = settings ?? this.store.getGenerationQueueSettings();
    const current = new Date();
    const currentMinute = current.getHours() * 60 + current.getMinutes();
    if (isGenerationQueueWindowOpen(queueSettings, currentMinute)) return 0;
    return Math.max(
      10,
      minutesUntilGenerationQueueWindow(queueSettings, currentMinute) *
        60_000 -
        current.getSeconds() * 1000 -
        current.getMilliseconds(),
    );
  }
  async generateImage(input: ImageJobRequest, existingJobId?: string) {
    input = imageJobRequestSchema.parse(input);
    const runtime = this.getRuntimeProfile?.();
    const dimensions = runtime
      ? constrainImageDimensions(
          input.width,
          input.height,
          runtime.limits.maxOutputDimension,
        )
      : { width: input.width, height: input.height, adjusted: false };
    const effectiveInput: ImageJobRequest = {
      ...input,
      width: dimensions.width,
      height: dimensions.height,
    };
    const queuedAhead = !existingJobId && this.store.nextQueuedImageJob();
    const outsideQueueWindow = this.queueWindowDelayMs() > 0;
    if (
      this.activeLocalImageJobId ||
      (runtime?.limits.exclusiveGpuWork && this.activeLocalTextRequests.size) ||
      queuedAhead ||
      outsideQueueWindow
    ) {
      const jobId =
        existingJobId ??
        this.store.createGenerationJob({
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
      if (!this.activeLocalImageJobId && !this.activeLocalTextRequests.size)
        queueMicrotask(() => void this.runNextQueuedImage());
      return { jobId, status: "queued" };
    }
    const settings = this.settings("comfyui");
    if (!settings.enabled)
      throw new AIProviderError(
        "PROVIDER_DISABLED",
        "ComfyUIが無効です。設定画面で有効にしてください。",
      );
    const provider = new ComfyUIProvider(
        settings,
        async (id) => this.store.getComfyWorkflow(id),
        this.getRuntimeProfile,
      ),
      jobId = existingJobId ?? this.store.createGenerationJob({
        projectId: input.projectId,
        episodeId: input.episodeId,
        pageId: input.pageId,
        providerType: "image",
        providerId: "comfyui",
        generationType: "image",
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        inputJson: runtime
          ? {
              ...input,
              runtimeProfile: runtime.effectiveProfile,
              effectiveWidth: effectiveInput.width,
              effectiveHeight: effectiveInput.height,
              dimensionsAdjusted: dimensions.adjusted,
            }
          : input,
      });
    const controller = new AbortController();
    let queuedProviderJobId: string | undefined;
    this.controllers.set(jobId, controller);
    try {
      const { decision, localProvider } = this.routeImageGeneration(
        jobId,
        input,
        settings,
      );
      if (decision.blocked)
        throw new AIProviderError(
          "ROUTE_BLOCKED",
          "この生成内容はローカル処理が必須ですが、ローカルComfyUIが設定されていません。ComfyUIのURLをlocalhostまたは127.0.0.1に設定してください。",
        );
      if (decision.requiresUserConfirmation)
        throw new AIProviderError(
          "ROUTE_CONFIRMATION_REQUIRED",
          "この生成には外部処理の確認が必要です。現在の画面では確認付き実行に未対応です。",
        );
      if (decision.target !== "local" || !localProvider)
        throw new AIProviderError(
          "ROUTE_TARGET_UNAVAILABLE",
          "この画像生成はローカルComfyUIでのみ実行できます。",
        );
      if (
        runtime?.limits.exclusiveGpuWork &&
        this.activeLocalTextRequests.size
      )
        throw new AIProviderError(
          "LOCAL_RESOURCE_BUSY",
          "低VRAM端末ではCreator Chatと画像生成を同時実行できません。Creator Chatが完了してから再試行してください。",
          true,
        );
      if (this.activeLocalImageJobId)
        throw new AIProviderError(
          "LOCAL_JOB_BUSY",
          "ローカル画像生成は同時に1件だけ実行できます。実行中の生成が完了してから再試行してください。",
          true,
        );
      this.activeLocalImageJobId = jobId;
      this.store.beginGenerationJobAttempt(jobId);
      const ollamaModelUnloaded = runtime?.limits.unloadTextModelBeforeImage
        ? await this.unloadLocalTextModel(controller.signal)
        : false;
      this.store.updateGenerationJob(jobId, "running", { progress: 0.05 });
      const queued = await provider.generateImage(
        effectiveInput as ImageGenerationRequest,
        undefined,
        controller.signal,
      );
      queuedProviderJobId = queued.providerJobId;
      this.store.updateGenerationJob(jobId, "running", {
        providerJobId: queued.providerJobId,
        progress: 0.15,
      });
      const deadline = Date.now() + settings.timeoutMs;
      while (Date.now() < deadline) {
        if (controller.signal.aborted) {
          await provider.cancelJob?.(queued.providerJobId);
          const stoppedStatus = this.pauseRequested.has(jobId)
            ? "paused"
            : "canceled";
          this.store.updateGenerationJob(jobId, stoppedStatus);
          return { jobId, status: stoppedStatus };
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
                  width: effectiveInput.width,
                  height: effectiveInput.height,
                  seed: input.seed,
                  jobType: input.jobType,
                  libraryTags: input.libraryTags,
                  createdAt: new Date().toISOString(),
                },
              );
              if (registered.created) {
                createdAssetIds.push(registered.assetId);
                if (input.jobType)
                  this.store.saveAssetLibraryMetadata({
                    assetId: registered.assetId,
                    category: input.jobType,
                    tags: input.libraryTags ?? [],
                    favorite: false,
                  });
              }
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
            runtimeProfile: runtime?.effectiveProfile,
            ollamaModelUnloaded,
            dimensionsAdjusted: dimensions.adjusted,
            effectiveWidth: effectiveInput.width,
            effectiveHeight: effectiveInput.height,
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
      if (controller.signal.aborted && queuedProviderJobId) {
        try {
          await provider.cancelJob?.(queuedProviderJobId);
        } catch {
          // 停止状態の永続化を優先する。
        }
      }
      if (
        !controller.signal.aborted &&
        error instanceof AIProviderError &&
        error.retryable
      ) {
        const job = this.store.getGenerationJob(jobId);
        const attemptCount = Number(job?.attempt_count ?? 1);
        const delayMs = Math.min(
          30_000,
          this.retryBaseDelayMs * 2 ** Math.max(0, attemptCount - 1),
        );
        if (
          this.store.requeueGenerationJob(
            jobId,
            error.code,
            error.message,
            delayMs,
          )
        ) {
          this.log("image_generation_retry_scheduled", error, {
            provider: "comfyui",
            jobId,
            attemptCount,
            delayMs,
          });
          this.scheduleQueueWake(delayMs);
          return { jobId, status: "queued", retryScheduled: true };
        }
      }
      this.log("image_generation_failed", error, {
        provider: "comfyui",
        jobId,
      });
      this.store.updateGenerationJob(
        jobId,
        controller.signal.aborted
          ? this.pauseRequested.has(jobId)
            ? "paused"
            : "canceled"
          : "failed",
        {
          errorCode: error instanceof AIProviderError ? error.code : "UNKNOWN",
          errorMessage:
            error instanceof Error ? error.message : "画像生成に失敗しました。",
        },
      );
      if (controller.signal.aborted)
        return {
          jobId,
          status: this.pauseRequested.has(jobId) ? "paused" : "canceled",
        };
      throw error;
    } finally {
      if (this.activeLocalImageJobId === jobId)
        this.activeLocalImageJobId = null;
      this.pauseRequested.delete(jobId);
      this.controllers.delete(jobId);
      queueMicrotask(() => void this.runNextQueuedImage());
    }
  }
}
