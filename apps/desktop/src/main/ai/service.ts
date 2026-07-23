import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import {
  AIProviderError,
  adultGenerationContentConfirmationSchema,
  createExternalDispatchPreview,
  constrainImageDimensions,
  evaluateAdultGenerationGate,
  evaluateAdultReferenceImage,
  evaluateAdultProviderCapability,
  externalDispatchConfirmationSchema,
  imageJobRequestSchema,
  isGenerationQueueWindowOpen,
  minutesUntilGenerationQueueWindow,
  routeGenerationJob,
  reviewAdultGenerationPrompt,
  safeAssetJobTypeSchema,
  type SafeAssetLibraryRequest,
  type SafeAssetJobType,
  type ExternalDispatchConfirmation,
  type ProjectGenerationPolicy,
  type RouteDecision,
  type ProviderSettings,
  type TextGenerationProvider,
  type ImageGenerationRequest,
  type ImageJobRequest,
  type PageBatchImageRequest,
  type GenerationQueueSettings,
  type RuntimeProfileState,
  type AdultGenerationSettings,
} from "@mangai/ai-core";
import { MangaiDatabase } from "../database.js";
import { OllamaProvider } from "./providers/ollama.js";
import { MockTextProvider } from "./providers/mock.js";
import { ComfyUIProvider } from "./providers/comfyui.js";
import {
  DezgoProvider,
  dezgoTextToImageRequestSchema,
} from "./providers/dezgo.js";
import type { DezgoFeatureFlags } from "./dezgo-feature-flags.js";
import {
  DEZGO_PRICING_VERSION,
  dezgoPreviewDimensions,
  evaluateDezgoCostGuard,
} from "./dezgo-cost-guard.js";
import {
  ExternalDispatchApprovalError,
  ExternalDispatchApprovalStore,
} from "./external-dispatch-approval.js";
import { persistDezgoGenerationResult } from "./dezgo-image-pipeline.js";
import { dezgoFailureDisposition } from "./dezgo-queue-policy.js";

const dezgoQueuedInputSchema = z.object({
  endpoint: z.literal("text2image"),
  jobType: safeAssetJobTypeSchema,
  model: z.string().trim().min(1).max(300),
  width: z.number().int().min(320).max(1024),
  height: z.number().int().min(320).max(1024),
  steps: z.number().int().min(10).max(150),
  guidance: z.number().finite().min(-20).max(20),
  sampler: z.enum([
    "ddim",
    "dpm",
    "dpm_single",
    "dpmpp_2m_karras",
    "euler",
    "euler_a",
    "k_lms",
    "pndm",
  ]),
  seed: z.number().int().min(0).max(4_294_967_295).optional(),
  format: z.enum(["jpg", "png", "webp"]),
  dispatchApproval: z.object({
    previewId: z.string().uuid(),
    confirmedAt: z.string().datetime(),
    estimatedCostUsd: z.number().finite().nonnegative(),
  }),
});

const adultDezgoQueuedInputSchema = z
  .object({
    endpoint: z.literal("text2image"),
    jobType: z.literal("adult_character_render"),
    model: z.string().trim().min(1).max(300),
    width: z.number().int().min(320).max(1024),
    height: z.number().int().min(320).max(1024),
    steps: z.number().int().min(10).max(150),
    guidance: z.number().finite().min(-20).max(20),
    sampler: z.enum([
      "ddim",
      "dpm",
      "dpm_single",
      "dpmpp_2m_karras",
      "euler",
      "euler_a",
      "k_lms",
      "pndm",
    ]),
    seed: z.number().int().min(0).max(4_294_967_295).optional(),
    format: z.enum(["jpg", "png", "webp"]),
    contentConfirmation: adultGenerationContentConfirmationSchema,
    localPolicyReviewPassed: z.literal(true),
    externalTransmissionReviewed: z.literal(true),
    dispatchApproval: z
      .object({
        previewId: z.string().uuid(),
        confirmedAt: z.string().datetime(),
        estimatedCostUsd: z.number().finite().nonnegative(),
      })
      .strict(),
  })
  .strict();

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
  private dezgoQueueWakeTimer: NodeJS.Timeout | undefined;
  private activeDezgoJobId: string | null = null;
  private allowMock: boolean;
  private getRuntimeProfile?: () => RuntimeProfileState;
  private retryBaseDelayMs: number;
  private getProviderCredential: (
    providerId: "dezgo",
  ) => Promise<string | null>;
  private getDezgoBalance: () => Promise<number | null>;
  private createDezgoProvider: () => Pick<DezgoProvider, "textToImage">;
  private dezgoFeatures: DezgoFeatureFlags;
  private externalDispatchApprovals = new ExternalDispatchApprovalStore();
  constructor(
    private store: MangaiDatabase,
    options: {
      allowMock?: boolean;
      getRuntimeProfile?: () => RuntimeProfileState;
      retryBaseDelayMs?: number;
      getProviderCredential?: (providerId: "dezgo") => Promise<string | null>;
      getDezgoBalance?: () => Promise<number | null>;
      createDezgoProvider?: () => Pick<DezgoProvider, "textToImage">;
      dezgoFeatures?: DezgoFeatureFlags;
    } = {},
  ) {
    this.allowMock =
      options.allowMock ?? process.env.MANGAI_ENABLE_MOCK_AI === "true";
    this.getRuntimeProfile = options.getRuntimeProfile;
    this.retryBaseDelayMs = Math.max(10, options.retryBaseDelayMs ?? 1000);
    this.getProviderCredential =
      options.getProviderCredential ?? (async () => null);
    this.getDezgoBalance =
      options.getDezgoBalance ??
      (() =>
        new DezgoProvider(() =>
          this.getProviderCredential("dezgo"),
        ).getBalance());
    this.createDezgoProvider =
      options.createDezgoProvider ??
      (() =>
        new DezgoProvider(() => this.getProviderCredential("dezgo")));
    this.dezgoFeatures = options.dezgoFeatures ?? {
      dezgoProviderEnabled: false,
      dezgoDirectByokEnabled: false,
      dezgoDispatchEnabled: false,
      dezgoAdultGenerationEnabled: false,
      dezgoBatchGenerationEnabled: false,
    };
  }
  isMockEnabled() {
    return this.allowMock;
  }
  getAdultGenerationSettings(): AdultGenerationSettings {
    return this.store.getAdultGenerationSettings();
  }
  getAdultProviderPolicyState() {
    return this.store.getAdultProviderPolicyState();
  }
  setAdultGenerationAdministratorEnabled(enabled: boolean) {
    const settings = this.store.setAdultGenerationAdministratorEnabled(enabled);
    if (!settings.administratorEnabled)
      this.store.stopUnauthorizedPendingAdultGenerationJobs();
    return settings;
  }
  confirmAdultGeneration18Plus(input: unknown) {
    return this.store.confirmAdultGeneration18Plus(input);
  }
  revokeAdultGenerationConsent() {
    const settings = this.store.revokeAdultGenerationConsent();
    this.store.stopUnauthorizedPendingAdultGenerationJobs();
    return settings;
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
      jobType?: SafeAssetJobType | "adult_character_render";
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
          sensitivity:
            input.jobType === "adult_character_render"
              ? ("adult" as const)
              : ("safe" as const),
          inputAssetIds: [],
          personPresence:
            input.jobType === "adult_character_render"
              ? ("unknown" as const)
              : ("none" as const),
          hasCharacterReference: false,
          hasCompletedPage: false,
          promptIncludesRestrictedContent:
            input.jobType === "adult_character_render",
          allInputAssetsExternalAllowed:
            input.jobType !== "adult_character_render",
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
  async previewExternalSafeAsset(input: SafeAssetLibraryRequest) {
    if (
      input.pageId &&
      this.store.projectIdForPage(input.pageId) !== input.projectId
    )
      throw new Error("PageとProjectの参照が一致しません。");
    const policy = this.store.getProjectGenerationPolicy(input.projectId);
    const dezgoEnabled =
      this.dezgoFeatures.dezgoProviderEnabled &&
      this.dezgoFeatures.dezgoDirectByokEnabled;
    const dezgoConfigured = dezgoEnabled
      ? Boolean(await this.getProviderCredential("dezgo"))
      : false;
    const costContext = await this.dezgoCostContext(
      input.projectId,
      policy,
      dezgoEnabled,
      dezgoConfigured,
      input.modelId,
    );
    const preview = createExternalDispatchPreview({
      previewId: crypto.randomUUID(),
      request: input,
      promptSha256: crypto
        .createHash("sha256")
        .update(input.query, "utf8")
        .digest("hex"),
      policy: policy.externalProcessingPolicy,
      customCloudJobTypes: policy.customCloudJobTypes,
      provider: {
        providerId: "dezgo",
        displayName: "Dezgo API",
        enabled: dezgoEnabled,
        endpointConfigured: dezgoConfigured,
        supportedJobTypes: ["background", "prop", "effect"],
        dataRetentionSummary: "ジョブデータは完了後30日間保持されます。",
        trainingUseSummary: "公式資料で学習利用条件を確認できていません。",
        pricingSummary:
          "公式価格表を基に25%の安全余裕を加えた承認上限です。実費は生成応答で照合します。",
      },
      estimate: {
        cost: costContext.guard.authorizationCostUsd,
        currency: costContext.guard.currency,
      },
      modelName: costContext.model?.name,
      requestBlockReason: costContext.requestBlockReason ?? undefined,
      costBlockReason: costContext.guard.blockReason ?? undefined,
      createdAt: new Date().toISOString(),
    });
    this.externalDispatchApprovals.register(
      preview,
      input,
      this.externalDispatchContextSha256(
        policy,
        dezgoEnabled,
        dezgoConfigured,
        costContext,
      ),
    );
    return preview;
  }
  async confirmExternalSafeAsset(
    input: ExternalDispatchConfirmation,
  ) {
    const confirmation = externalDispatchConfirmationSchema.parse(input);
    const projectId = this.externalDispatchApprovals.projectIdForPreview(
      confirmation.previewId,
    );
    if (!projectId)
      throw new ExternalDispatchApprovalError(
        "PREVIEW_NOT_FOUND",
        "外部送信プレビューが見つかりません。もう一度確認してください。",
      );
    const preview = this.externalDispatchApprovals.previewFor(
      confirmation.previewId,
    );
    if (!preview)
      throw new ExternalDispatchApprovalError(
        "PREVIEW_NOT_FOUND",
        "外部送信プレビューが見つかりません。もう一度確認してください。",
      );
    const policy = this.store.getProjectGenerationPolicy(projectId);
    const dezgoEnabled =
      this.dezgoFeatures.dezgoProviderEnabled &&
      this.dezgoFeatures.dezgoDirectByokEnabled;
    const dezgoConfigured = dezgoEnabled
      ? Boolean(await this.getProviderCredential("dezgo"))
      : false;
    const costContext = await this.dezgoCostContext(
      projectId,
      policy,
      dezgoEnabled,
      dezgoConfigured,
      preview.modelId ?? undefined,
    );
    const approval = this.externalDispatchApprovals.confirm(
      confirmation,
      this.externalDispatchContextSha256(
        policy,
        dezgoEnabled,
        dezgoConfigured,
        costContext,
      ),
    );
    try {
      this.store.reserveExternalCost({
        projectId,
        providerId: "dezgo",
        approvalToken: approval.approvalToken,
        amountUsd: preview.estimatedCost ?? 0,
        monthlyLimitUsd: policy.monthlyCostLimit,
      });
      return approval;
    } catch (error) {
      this.externalDispatchApprovals.revoke(approval.approvalToken);
      throw error;
    }
  }
  consumeExternalDispatchApproval(approvalToken: string) {
    try {
      return this.externalDispatchApprovals.consume(approvalToken);
    } catch (error) {
      this.store.releaseExternalCostReservation(approvalToken);
      throw error;
    }
  }
  async confirmAndEnqueueExternalSafeAsset(
    input: ExternalDispatchConfirmation,
  ) {
    const approval = await this.confirmExternalSafeAsset(input);
    try {
      const dispatch = this.consumeExternalDispatchApproval(
        approval.approvalToken,
      );
      if (!dispatch.request.modelId)
        throw new Error("Dezgoモデルが選択されていません。");
      const project = this.store.bundle(dispatch.request.projectId).project;
      const dimensions = dezgoPreviewDimensions(project.width, project.height);
      const policy = this.store.getProjectGenerationPolicy(
        dispatch.request.projectId,
      );
      const draft = {
        projectId: dispatch.request.projectId,
        pageId: dispatch.request.pageId,
        type: dispatch.request.type,
        sensitivity: "safe" as const,
        requestedTarget: "cloud" as const,
        inputAssetIds: [],
        personPresence: "none" as const,
        hasCharacterReference: false,
        hasCompletedPage: false,
        promptIncludesRestrictedContent: false,
        allInputAssetsExternalAllowed: true,
      };
      const context = {
        policy: policy.externalProcessingPolicy,
        availableTargets: ["cloud" as const],
        preferLocal: policy.preferLocal,
        externalProviderEnabled: true,
        externalCostWithinLimit: true,
        requireExternalConfirmation: policy.externalConfirmationRequired,
        manualApprovalGranted: true,
        customCloudJobTypes: policy.customCloudJobTypes,
        sensitiveRenderNodeAllowed: false,
        cloudProviderId: "dezgo",
      };
      const decision = routeGenerationJob(draft, context);
      if (decision.blocked || decision.target !== "cloud")
        throw new Error("現在のProjectポリシーではDezgo Queueへ追加できません。");
      const jobId = this.store.createApprovedExternalGenerationJob({
        approvalToken: approval.approvalToken,
        projectId: dispatch.request.projectId,
        pageId: dispatch.request.pageId,
        providerId: "dezgo",
        modelId: dispatch.request.modelId,
        prompt: dispatch.request.query,
        inputJson: {
          endpoint: "text2image",
          jobType: dispatch.request.type,
          model: dispatch.request.modelId,
          ...dimensions,
          steps: 30,
          guidance: 7,
          sampler: "dpmpp_2m_karras",
          format: "png",
          dispatchApproval: {
            previewId: dispatch.preview.previewId,
            confirmedAt: dispatch.confirmedAt,
            estimatedCostUsd: dispatch.preview.estimatedCost,
          },
        },
        routeAudit: {
          draft,
          context,
          decision,
          promptSha256: dispatch.preview.promptSha256,
        },
      });
      if (this.dezgoFeatures.dezgoDispatchEnabled)
        queueMicrotask(() => void this.runNextQueuedDezgo());
      return {
        jobId,
        status: "queued" as const,
        providerId: "dezgo" as const,
        modelId: dispatch.request.modelId,
      };
    } catch (error) {
      this.releaseExternalDispatchCost(approval.approvalToken);
      throw error;
    }
  }
  settleExternalDispatchCost(
    approvalToken: string,
    actualAmountUsd: number,
    jobId?: string,
  ) {
    return this.store.settleExternalCost({
      approvalToken,
      actualAmountUsd,
      jobId,
    });
  }
  releaseExternalDispatchCost(approvalToken: string) {
    return this.store.releaseExternalCostReservation(approvalToken);
  }
  settleExternalDispatchCostForJob(jobId: string, actualAmountUsd: number) {
    return this.store.settleExternalCostForJob({ jobId, actualAmountUsd });
  }
  private async dezgoCostContext(
    projectId: string,
    policy: ProjectGenerationPolicy,
    providerEnabled: boolean,
    providerConfigured: boolean,
    modelId?: string,
  ) {
    const project = this.store.bundle(projectId).project;
    const dimensions = dezgoPreviewDimensions(project.width, project.height);
    const summary = this.store.externalCostSummary(projectId, "dezgo");
    const model = modelId
      ? this.store
          .listAIModels("dezgo")
          .find((candidate) => candidate.id === modelId)
      : undefined;
    const requestBlockReason = !modelId
      ? ("model_not_selected" as const)
      : !model?.supportedFunctions?.includes("text_to_image")
        ? ("model_unavailable" as const)
        : null;
    let balanceUsd: number | null = null;
    if (providerEnabled && providerConfigured && !requestBlockReason) {
      try {
        balanceUsd = await this.getDezgoBalance();
      } catch (error) {
        this.log("dezgo_balance_failed", error, { projectId });
      }
    }
    const steps = 30;
    return {
      dimensions,
      steps,
      model,
      requestBlockReason,
      guard: evaluateDezgoCostGuard({
        ...dimensions,
        steps,
        monthlyLimitUsd: policy.monthlyCostLimit,
        monthlyActualUsd: summary.actualUsd,
        monthlyReservedUsd: summary.reservedUsd,
        balanceUsd,
      }),
    };
  }
  private externalDispatchContextSha256(
    policy: ProjectGenerationPolicy,
    providerEnabled: boolean,
    providerConfigured: boolean,
    costContext: Awaited<ReturnType<AIService["dezgoCostContext"]>>,
  ) {
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          projectId: policy.projectId,
          externalProcessingPolicy: policy.externalProcessingPolicy,
          preferLocal: policy.preferLocal,
          externalConfirmationRequired: policy.externalConfirmationRequired,
          monthlyCostLimit: policy.monthlyCostLimit,
          customCloudJobTypes: policy.customCloudJobTypes,
          policyUpdatedAt: policy.updatedAt,
          providerId: "dezgo",
          providerEnabled,
          providerConfigured,
          pricingVersion: DEZGO_PRICING_VERSION,
          dimensions: costContext.dimensions,
          steps: costContext.steps,
          authorizationCostUsd: costContext.guard.authorizationCostUsd,
          monthlyActualUsd: costContext.guard.monthlyActualUsd,
          monthlyReservedUsd: costContext.guard.monthlyReservedUsd,
          balanceUsd: costContext.guard.balanceUsd,
          costBlockReason: costContext.guard.blockReason,
          modelId: costContext.model?.id ?? null,
          modelUpdatedAt: costContext.model?.updatedAt ?? null,
          requestBlockReason: costContext.requestBlockReason,
        }),
        "utf8",
      )
      .digest("hex");
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
      if (job && ["queued", "paused"].includes(String(job.status))) {
        this.store.setGenerationJobStatus(requestId, "canceled");
        if (job.provider_id === "dezgo")
          this.store.releaseExternalCostReservationForJob(requestId);
      }
    }
  }
  pauseImageJob(jobId: string) {
    const job = this.store.getGenerationJob(jobId);
    if (!job) return false;
    if (job.status === "running") {
      if (job.provider_id === "dezgo") return false;
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
    if (changed) {
      if (job.provider_id === "dezgo") void this.runNextQueuedDezgo();
      else void this.runNextQueuedImage();
    }
    return changed;
  }
  changeImageJobPriority(jobId: string, delta: number) {
    return this.store.changeGenerationJobPriority(jobId, delta);
  }
  resumeQueuedImages() {
    void this.runNextQueuedImage();
    void this.runNextQueuedDezgo();
  }
  getQueueSettings() {
    return this.store.getGenerationQueueSettings();
  }
  saveQueueSettings(input: unknown) {
    const settings = this.store.saveGenerationQueueSettings(input);
    if (this.queueWakeTimer) clearTimeout(this.queueWakeTimer);
    this.queueWakeTimer = undefined;
    void this.runNextQueuedImage();
    if (this.dezgoQueueWakeTimer) clearTimeout(this.dezgoQueueWakeTimer);
    this.dezgoQueueWakeTimer = undefined;
    void this.runNextQueuedDezgo();
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
    if (bundle.project.ageRating === "成人向け")
      throw new AIProviderError(
        "ADULT_BATCH_CONFIRMATION_REQUIRED",
        "成人向けProjectは内容確認が必要なため、1枚ずつ生成してください。",
      );
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
        operation: "text_to_image",
        denoiseStrength: 0.65,
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
  async runNextQueuedDezgo() {
    if (
      !this.dezgoFeatures.dezgoDispatchEnabled ||
      this.activeDezgoJobId
    )
      return null;
    this.store.stopUnauthorizedPendingAdultGenerationJobs();
    this.store.stopPendingAdultDezgoJobsDisallowedByPolicy();
    const windowDelay = this.queueWindowDelayMs();
    if (windowDelay > 0) {
      this.scheduleDezgoQueueWake(windowDelay);
      return null;
    }
    const next = this.store.nextQueuedImageJob(["dezgo"]);
    if (!next) {
      const delay = this.store.nextQueuedImageDelayMs(["dezgo"]);
      if (delay !== null) this.scheduleDezgoQueueWake(delay);
      return null;
    }
    const job = this.store.getGenerationJob(next.id);
    const reservation = this.store.externalCostReservationForJob(next.id);
    if (!job || !reservation) {
      this.store.updateGenerationJob(next.id, "failed", {
        errorCode: "DEZGO_APPROVAL_MISSING",
        errorMessage:
          "Dezgo生成の費用予約を確認できません。もう一度確認してQueueへ追加してください。",
      });
      queueMicrotask(() => void this.runNextQueuedDezgo());
      return { jobId: next.id, status: "failed" as const };
    }
    let request: z.infer<typeof dezgoTextToImageRequestSchema>;
    let jobType: SafeAssetJobType;
    try {
      if (typeof job.project_id !== "string" || !job.project_id)
        throw new Error("Project参照がありません。");
      const stored = dezgoQueuedInputSchema.parse(JSON.parse(next.inputJson));
      request = dezgoTextToImageRequestSchema.parse({
        ...stored,
        prompt: String(job.prompt ?? ""),
        negativePrompt: String(job.negative_prompt ?? ""),
      });
      jobType = stored.jobType;
    } catch (error) {
      this.store.releaseExternalCostReservationForJob(next.id);
      this.store.updateGenerationJob(next.id, "failed", {
        errorCode: "DEZGO_JOB_INVALID",
        errorMessage:
          "Dezgo Queueの保存内容が不正です。確認画面からもう一度追加してください。",
      });
      this.log("dezgo_job_invalid", error, {
        provider: "dezgo",
        jobId: next.id,
      });
      queueMicrotask(() => void this.runNextQueuedDezgo());
      return { jobId: next.id, status: "failed" as const };
    }
    const controller = new AbortController();
    this.controllers.set(next.id, controller);
    this.activeDezgoJobId = next.id;
    const attempt = this.store.beginGenerationJobAttempt(next.id);
    let providerResponded = false;
    let costSettled = false;
    try {
      this.store.updateGenerationJob(next.id, "running", { progress: 0.1 });
      const startedAt = Date.now();
      const result = await this.createDezgoProvider().textToImage(
        request,
        controller.signal,
      );
      providerResponded = true;
      const accountedCostUsd =
        result.metadata.actualCostUsd ?? reservation.reservedAmountUsd;
      this.store.settleExternalCostForJob({
        jobId: next.id,
        actualAmountUsd: accountedCostUsd,
      });
      costSettled = true;
      this.store.updateGenerationJob(next.id, "running", { progress: 0.85 });
      const persisted = await persistDezgoGenerationResult(this.store, {
        jobId: next.id,
        projectId: String(job.project_id),
        request,
        result,
        durationMs: Date.now() - startedAt,
        accountedCostUsd,
        billingAmountSource:
          result.metadata.actualCostUsd === null
            ? "authorization_ceiling"
            : "provider_header",
        jobType,
        libraryTags: [],
      });
      return {
        jobId: next.id,
        status: "completed" as const,
        assetId: persisted.assetId,
      };
    } catch (error) {
      const aborted = controller.signal.aborted;
      if (aborted) {
        if (!costSettled)
          this.store.settleExternalCostForJob({
            jobId: next.id,
            actualAmountUsd: reservation.reservedAmountUsd,
          });
        this.store.updateGenerationJob(next.id, "canceled", {
          errorCode: "DEZGO_CANCELED",
          errorMessage:
            "Dezgo生成を停止しました。課金状態を確認できないため承認上限を利用額として記録しました。",
        });
        return { jobId: next.id, status: "canceled" as const };
      }
      const disposition = dezgoFailureDisposition(error, attempt.attemptCount);
      const errorCode =
        error instanceof AIProviderError ? error.code : "DEZGO_DISPATCH_FAILED";
      const errorMessage =
        error instanceof Error ? error.message : "Dezgo生成に失敗しました。";
      if (!providerResponded && disposition === "retry") {
        const delayMs = Math.min(
          30_000,
          this.retryBaseDelayMs * 2 ** Math.max(0, attempt.attemptCount - 1),
        );
        const requeued = this.store.requeueGenerationJob(
          next.id,
          errorCode,
          errorMessage,
          delayMs,
        );
        if (requeued) {
          this.scheduleDezgoQueueWake(delayMs);
          return { jobId: next.id, status: "queued" as const };
        }
      }
      if (!providerResponded && disposition === "hold") {
        this.store.updateGenerationJob(next.id, "paused", {
          errorCode,
          errorMessage,
        });
        return { jobId: next.id, status: "paused" as const };
      }
      if (!costSettled && errorCode === "DEZGO_TIMEOUT") {
        this.store.settleExternalCostForJob({
          jobId: next.id,
          actualAmountUsd: reservation.reservedAmountUsd,
        });
      } else if (!costSettled && !providerResponded) {
        this.store.releaseExternalCostReservationForJob(next.id);
      }
      this.store.updateGenerationJob(next.id, "failed", {
        errorCode,
        errorMessage,
      });
      this.log("dezgo_generation_failed", error, {
        provider: "dezgo",
        jobId: next.id,
        attemptCount: attempt.attemptCount,
      });
      return { jobId: next.id, status: "failed" as const };
    } finally {
      if (this.activeDezgoJobId === next.id) this.activeDezgoJobId = null;
      this.controllers.delete(next.id);
      queueMicrotask(() => void this.runNextQueuedDezgo());
    }
  }
  evaluateAdultDezgoDispatchGate(
    jobId: string,
    referenceTime = new Date().toISOString(),
  ) {
    const job = this.store.getGenerationJob(jobId);
    if (
      !job ||
      job.provider_id !== "dezgo" ||
      job.generation_type !== "image" ||
      typeof job.project_id !== "string" ||
      !job.project_id ||
      typeof job.model_id !== "string" ||
      !job.model_id
    )
      throw new AIProviderError(
        "ADULT_DEZGO_JOB_INVALID",
        "成人向けDezgo QueueのJob参照が不正です。",
      );
    const input = adultDezgoQueuedInputSchema.parse(
      JSON.parse(String(job.input_json ?? "{}")),
    );
    if (input.model !== job.model_id)
      throw new AIProviderError(
        "ADULT_DEZGO_JOB_INVALID",
        "成人向けDezgo Queueのモデル参照が一致しません。",
      );
    const project = this.store.bundle(job.project_id).project;
    const settings = this.store.getAdultGenerationSettings(referenceTime);
    const approval = this.store.getAdultProviderApproval();
    const model =
      this.store
        .listAdultModelApprovals()
        .find((candidate) => candidate.modelId === job.model_id) ?? null;
    const providerCapability = evaluateAdultProviderCapability({
      approval,
      model,
      referenceTime,
    });
    const providerApprovalValid =
      providerCapability.allowed ||
      providerCapability.reason === "model_not_allowlisted" ||
      providerCapability.reason === "model_revoked" ||
      providerCapability.reason === "model_approval_expired";
    const promptReview = reviewAdultGenerationPrompt(String(job.prompt ?? ""));
    return evaluateAdultGenerationGate({
      userConfirmed18Plus: settings.userConfirmed18Plus,
      projectAgeRating: project.ageRating,
      jobType: input.jobType,
      characterIsFictional: input.contentConfirmation.fictionalAdultsOnly,
      allDepictedCharactersExplicitly18Plus:
        input.contentConfirmation.allCharacters18Plus,
      minorOrAgeAmbiguousAppearanceDetected:
        !input.contentConfirmation.noMinorOrAgeAmbiguousAppearance,
      realPersonReferenceIncluded:
        !input.contentConfirmation.noRealPersonReference,
      nonConsensualOrExploitativeContentDetected:
        !input.contentConfirmation.consensualAndNonExploitativeOnly,
      rightsConfirmed: input.contentConfirmation.rightsConfirmed,
      localPolicyReviewPassed:
        input.localPolicyReviewPassed && promptReview.allowed,
      externalTransmissionReviewed: input.externalTransmissionReviewed,
      administratorAdultGenerationEnabled: settings.administratorEnabled,
      providerAdultCommercialUseApproval: providerApprovalValid
        ? "approved"
        : approval.status,
      providerApprovalReferenceSha256:
        providerApprovalValid && approval.evidenceSha256
          ? approval.evidenceSha256
          : undefined,
      selectedModelAdultUseApproved: providerCapability.allowed,
      adultGenerationFeatureEnabled:
        this.dezgoFeatures.dezgoAdultGenerationEnabled,
    });
  }
  async runNextQueuedAdultDezgo() {
    this.store.stopUnauthorizedPendingAdultGenerationJobs();
    this.store.stopPendingAdultDezgoJobsDisallowedByPolicy();
    const next = this.store.nextQueuedAdultDezgoJob();
    if (!next) return null;
    try {
      const gate = this.evaluateAdultDezgoDispatchGate(next.id);
      if (!gate.allowed) {
        this.store.releaseExternalCostReservationForJob(next.id);
        this.store.updateGenerationJob(next.id, "failed", {
          errorCode: `ADULT_GATE_${gate.reason.toUpperCase()}`,
          errorMessage:
            "成人向け外部生成の送信直前条件を満たさないため、Queueを停止しました。",
        });
        return {
          jobId: next.id,
          status: "failed" as const,
          reason: gate.reason,
        };
      }
      this.store.releaseExternalCostReservationForJob(next.id);
      this.store.updateGenerationJob(next.id, "failed", {
        errorCode: "ADULT_DEZGO_DISPATCH_NOT_CONNECTED",
        errorMessage:
          "成人向けDezgo dispatcherは安全確認中のため、外部送信へ接続されていません。",
      });
      return {
        jobId: next.id,
        status: "failed" as const,
        reason: "dispatcher_not_connected" as const,
      };
    } catch (error) {
      this.store.releaseExternalCostReservationForJob(next.id);
      this.store.updateGenerationJob(next.id, "failed", {
        errorCode:
          error instanceof AIProviderError
            ? error.code
            : "ADULT_DEZGO_JOB_INVALID",
        errorMessage:
          "成人向けDezgo Queueの保存内容が不正なため、外部送信せず停止しました。",
      });
      return {
        jobId: next.id,
        status: "failed" as const,
        reason: "job_invalid" as const,
      };
    }
  }
  private scheduleDezgoQueueWake(delayMs: number) {
    if (this.dezgoQueueWakeTimer) clearTimeout(this.dezgoQueueWakeTimer);
    this.dezgoQueueWakeTimer = setTimeout(() => {
      this.dezgoQueueWakeTimer = undefined;
      void this.runNextQueuedDezgo();
    }, Math.max(10, delayMs));
    this.dezgoQueueWakeTimer.unref?.();
  }
  private async runNextQueuedImage() {
    this.store.stopUnauthorizedPendingAdultGenerationJobs();
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
    const next = this.store.nextQueuedImageJob(["comfyui"]);
    if (!next) {
      const delay = this.store.nextQueuedImageDelayMs(["comfyui"]);
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
    let characterReferenceAssetIds: string[] = [];
    if (input.characterProfileId) {
      const profile = this.store.getCharacterProfile(
        input.projectId,
        input.characterProfileId,
      );
      characterReferenceAssetIds = profile.referenceAssets.map(
        (reference) => reference.assetId,
      );
      input = {
        ...input,
        prompt: [profile.prompt, input.prompt].filter(Boolean).join(", "),
        negativePrompt: [profile.negativePrompt, input.negativePrompt]
          .filter(Boolean)
          .join(", "),
      };
    }
    if (input.jobType === "adult_character_render") {
      const settings = this.store.getAdultGenerationSettings();
      if (!settings.administratorEnabled)
        throw new AIProviderError(
          "ADULT_GENERATION_ADMIN_DISABLED",
          "管理者設定で成人向け生成が無効です。設定画面で確認してください。",
        );
      if (!settings.userConfirmed18Plus)
        throw new AIProviderError(
          "ADULT_GENERATION_CONSENT_REQUIRED",
          "18歳以上の確認が無効または期限切れです。設定画面で確認してください。",
        );
      if (this.store.bundle(input.projectId).project.ageRating !== "成人向け")
        throw new AIProviderError(
          "ADULT_PROJECT_REQUIRED",
          "成人向け生成は対象年齢が成人向けのProjectでのみ利用できます。",
        );
      const review = reviewAdultGenerationPrompt(input.prompt);
      if (!review.allowed)
        throw new AIProviderError(
          `ADULT_POLICY_${review.reason.toUpperCase()}`,
          review.reason === "minor_or_age_ambiguous"
            ? "未成年または年齢が曖昧な表現を含むため生成できません。"
            : review.reason === "real_person_reference"
              ? "実在人物を参照する表現を含むため生成できません。"
              : "非同意または搾取的な表現を含むため生成できません。",
        );
      const referenceAssetIds = [
        ...new Set([
          ...(input.sourceAssetId ? [input.sourceAssetId] : []),
          ...characterReferenceAssetIds,
        ]),
      ];
      for (const assetId of referenceAssetIds) {
        const assessment = this.store.getAdultReferenceImageAssessment(
          input.projectId,
          assetId,
        );
        const result = evaluateAdultReferenceImage(assessment);
        if (result.allowed) continue;
        const error = {
          assessment_missing: {
            code: "ADULT_REFERENCE_ASSESSMENT_REQUIRED",
            message:
              "成人向け生成に使う参照画像のローカル安全確認が必要です。",
          },
          local_model_review_required: {
            code: "ADULT_REFERENCE_LOCAL_REVIEW_REQUIRED",
            message:
              "参照画像は端末内モデルによる安全確認が必要です。",
          },
          person_presence_unknown: {
            code: "ADULT_REFERENCE_PERSON_UNKNOWN",
            message:
              "参照画像に人物が含まれるか判定できないため生成できません。",
          },
          minor_or_age_ambiguous: {
            code: "ADULT_REFERENCE_MINOR_OR_AGE_AMBIGUOUS",
            message:
              "参照画像の人物が成人と確認できないため生成できません。",
          },
          real_person_possible: {
            code: "ADULT_REFERENCE_REAL_PERSON_POSSIBLE",
            message:
              "参照画像が実在人物でないと確認できないため生成できません。",
          },
        }[result.reason];
        throw new AIProviderError(error.code, error.message);
      }
      const comfySettings = this.settings("comfyui");
      if (!this.isLoopbackUrl(comfySettings.baseUrl))
        throw new AIProviderError(
          "ADULT_LOCAL_PROVIDER_REQUIRED",
          "成人向け生成はこの段階では端末内ComfyUIでのみ実行できます。",
        );
    }
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
    const queuedAhead =
      !existingJobId && this.store.nextQueuedImageJob(["comfyui"]);
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
      const providerInput: ImageGenerationRequest = {
        ...effectiveInput,
        operation: effectiveInput.operation,
        inputImage: effectiveInput.sourceAssetId
          ? this.store.readGenerationInputAsset(
              input.projectId,
              effectiveInput.sourceAssetId,
            )
          : undefined,
        maskImage: effectiveInput.maskAssetId
          ? this.store.readGenerationInputAsset(
              input.projectId,
              effectiveInput.maskAssetId,
            )
          : undefined,
      };
      const queued = await provider.generateImage(
        providerInput,
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
                  ...(input.jobType === "adult_character_render"
                    ? { adultContent: true }
                    : {
                        prompt: input.prompt,
                        negativePrompt: input.negativePrompt,
                      }),
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
                const libraryCategory = safeAssetJobTypeSchema.safeParse(
                  input.jobType,
                );
                if (libraryCategory.success)
                  this.store.saveAssetLibraryMetadata({
                    assetId: registered.assetId,
                    category: libraryCategory.data,
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
