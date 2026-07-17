import React from "react";
import type { Asset, ProjectBundle } from "@mangai/project-core";
import type {
  ExternalDispatchPreview,
  GenerationQueueSettings,
  RouteDecision,
} from "@mangai/ai-core";
import { useI18n } from "../../i18n";
import { ProjectGenerationPolicySettings } from "./ProjectGenerationPolicySettings";

function generationStatusKey(status: string) {
  if (status === "queued") return "generation.status.queued" as const;
  if (status === "paused") return "generation.status.paused" as const;
  if (status === "running") return "generation.status.running" as const;
  if (status === "completed") return "generation.status.completed" as const;
  if (status === "canceled") return "generation.status.canceled" as const;
  return "generation.status.failed" as const;
}
function routeTargetKey(target: string) {
  if (target === "builtin") return "generation.routeTarget.builtin" as const;
  if (target === "local") return "generation.routeTarget.local" as const;
  if (target === "cloud") return "generation.routeTarget.cloud" as const;
  if (target === "render_node")
    return "generation.routeTarget.renderNode" as const;
  return "generation.routeTarget.assetLibrary" as const;
}
function sensitivityKey(sensitivity: string) {
  if (sensitivity === "safe") return "generation.sensitivity.safe" as const;
  if (sensitivity === "restricted")
    return "generation.sensitivity.restricted" as const;
  if (sensitivity === "adult") return "generation.sensitivity.adult" as const;
  return "generation.sensitivity.externalForbidden" as const;
}
function routeReasonKey(reason: string) {
  const keys = {
    builtin_operation: "generation.routeReason.builtinOperation",
    explicit_target: "generation.routeReason.explicitTarget",
    sensitive_local_only: "generation.routeReason.sensitiveLocalOnly",
    sensitive_render_node: "generation.routeReason.sensitiveRenderNode",
    project_local_only: "generation.routeReason.projectLocalOnly",
    asset_library_preferred: "generation.routeReason.assetLibraryPreferred",
    external_background_allowed:
      "generation.routeReason.externalBackgroundAllowed",
    external_safe_asset_allowed:
      "generation.routeReason.externalSafeAssetAllowed",
    external_manual_approval: "generation.routeReason.externalManualApproval",
    external_custom_policy: "generation.routeReason.externalCustomPolicy",
    local_fallback: "generation.routeReason.localFallback",
    required_target_unavailable:
      "generation.routeReason.requiredTargetUnavailable",
  } as const;
  return keys[reason as keyof typeof keys] ?? keys.required_target_unavailable;
}
function externalBlockReasonKey(reason: string | null) {
  if (reason === "provider_disabled")
    return "generation.externalBlock.providerDisabled" as const;
  if (reason === "unsupported_job_type")
    return "generation.externalBlock.unsupportedJob" as const;
  if (reason === "policy_blocked")
    return "generation.externalBlock.policyBlocked" as const;
  if (reason === "model_not_selected")
    return "generation.externalBlock.modelNotSelected" as const;
  if (reason === "model_unavailable")
    return "generation.externalBlock.modelUnavailable" as const;
  if (reason === "pricing_stale")
    return "generation.externalBlock.pricingStale" as const;
  if (reason === "cost_limit_not_set")
    return "generation.externalBlock.costLimitNotSet" as const;
  if (reason === "cost_limit_exceeded")
    return "generation.externalBlock.costLimitExceeded" as const;
  if (reason === "balance_unavailable")
    return "generation.externalBlock.balanceUnavailable" as const;
  if (reason === "balance_insufficient")
    return "generation.externalBlock.balanceInsufficient" as const;
  if (reason === "cost_estimate_unavailable")
    return "generation.externalBlock.costUnavailable" as const;
  return "generation.externalBlock.providerNotConfigured" as const;
}
type SafeAssetResult = {
  jobId: string;
  status: "completed" | "failed";
  decision: RouteDecision;
  assets: Asset[];
  message?: string;
};
type ExternalModel = Awaited<
  ReturnType<typeof window.mangai.ai.listModels>
>[number];
type GenerationOutputSummary = {
  assetId?: string;
  model?: string;
  actualCostUsd?: number;
  balanceUsd?: number;
  responseSeed?: number;
  requestedSeed?: number;
  durationMs?: number;
  width?: number;
  height?: number;
  steps?: number;
  sampler?: string;
};
function parseGenerationOutput(value: unknown): GenerationOutputSummary | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    const source = parsed as Record<string, unknown>;
    const text = (key: string) =>
      typeof source[key] === "string" && source[key].trim()
        ? source[key].trim()
        : undefined;
    const number = (key: string) =>
      typeof source[key] === "number" && Number.isFinite(source[key])
        ? source[key]
        : undefined;
    return {
      assetId: text("assetId"),
      model: text("model"),
      actualCostUsd: number("actualCostUsd"),
      balanceUsd: number("balanceUsd"),
      responseSeed: number("responseSeed"),
      requestedSeed: number("requestedSeed"),
      durationMs: number("durationMs"),
      width: number("width"),
      height: number("height"),
      steps: number("steps"),
      sampler: text("sampler"),
    };
  } catch {
    return null;
  }
}
function splitLibraryTags(value: string) {
  return value
    .split(/[,、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}
export function GenerationJobs({
  bundle,
  episodeId,
  pageId,
  onBundle,
  onSelectAsset,
  onClose,
}: {
  bundle: ProjectBundle;
  episodeId?: string;
  pageId?: string;
  onBundle: (value: ProjectBundle) => void;
  onSelectAsset: (id: string) => void;
  onClose: () => void;
}) {
  const { t, localizeMessage, formatDateTime, localeCode } = useI18n();
  const formatUsd = React.useCallback(
    (value: number) =>
      new Intl.NumberFormat(localeCode, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }).format(value),
    [localeCode],
  );
  const formatDuration = React.useCallback(
    (value: number) =>
      value < 1_000
        ? t("generation.durationMilliseconds", { value: Math.round(value) })
        : t("generation.durationSeconds", {
            value: (value / 1_000).toFixed(1),
          }),
    [t],
  );
  const [jobs, setJobs] = React.useState<any[]>([]),
    [routes, setRoutes] = React.useState<any[]>([]),
    [workflows, setWorkflows] = React.useState<any[]>([]),
    [workflowId, setWorkflowId] = React.useState(""),
    [promptText, setPrompt] = React.useState(""),
    [negative, setNegative] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [generationNotice, setGenerationNotice] = React.useState(""),
    [workflowMessage, setWorkflowMessage] = React.useState("");
  const [safeType, setSafeType] = React.useState<
      "background" | "prop" | "effect"
    >("background"),
    [safeQuery, setSafeQuery] = React.useState(""),
    [safeBusy, setSafeBusy] = React.useState(false),
    [safeResult, setSafeResult] = React.useState<SafeAssetResult | null>(null),
    [safeHandoff, setSafeHandoff] = React.useState<{
      type: "background" | "prop" | "effect";
      tags: string[];
    } | null>(null),
    [externalPreview, setExternalPreview] =
      React.useState<ExternalDispatchPreview | null>(null),
    [externalPreviewBusy, setExternalPreviewBusy] = React.useState(false),
    [externalModels, setExternalModels] = React.useState<ExternalModel[]>([]),
    [externalModelsBusy, setExternalModelsBusy] = React.useState(false),
    [externalModelId, setExternalModelId] = React.useState(""),
    [externalConfirmOpen, setExternalConfirmOpen] = React.useState(false),
    [externalEnqueueBusy, setExternalEnqueueBusy] = React.useState(false),
    [externalConfirmError, setExternalConfirmError] = React.useState(""),
    [externalQueueMessage, setExternalQueueMessage] = React.useState(""),
    [externalChecks, setExternalChecks] = React.useState({
      payload: false,
      cost: false,
      terms: false,
    }),
    [safeAssetUrls, setSafeAssetUrls] = React.useState<Record<string, string>>(
      {},
    );
  const [queueSettings, setQueueSettings] =
    React.useState<GenerationQueueSettings>({
      nightModeEnabled: false,
      startTime: "22:00",
      endTime: "07:00",
    });
  const [queueSettingsMessage, setQueueSettingsMessage] = React.useState("");
  const [batchBusy, setBatchBusy] = React.useState(false);
  const [batchMessage, setBatchMessage] = React.useState("");
  const externalConfirmTitleRef = React.useRef<HTMLHeadingElement>(null);
  const externalConfirmRef = React.useRef<HTMLElement>(null);
  const externalConfirmOpenButtonRef = React.useRef<HTMLButtonElement>(null);
  const externalQueueMessageRef = React.useRef<HTMLParagraphElement>(null);
  const completedImageCount = React.useRef<number | null>(null);
  const load = async () => {
    const [nextJobs, nextRoutes, nextWorkflows] = await Promise.all([
      window.mangai.ai.listJobs(bundle.project.id),
      window.mangai.ai.listRouteDecisions(bundle.project.id),
      window.mangai.ai.listWorkflows(),
    ]);
    setJobs(nextJobs);
    setRoutes(nextRoutes);
    setWorkflows(nextWorkflows);
    const nextCompletedCount = nextJobs.filter(
      (job: any) =>
        job.generationType === "image" && job.status === "completed",
    ).length;
    if (
      completedImageCount.current !== null &&
      nextCompletedCount > completedImageCount.current
    )
      onBundle(await window.mangai.openProject(bundle.project.id));
    completedImageCount.current = nextCompletedCount;
  };
  React.useEffect(() => {
    void load();
    void window.mangai.ai.getQueueSettings().then(setQueueSettings);
    const timer = window.setInterval(() => void load(), 1500);
    return () => window.clearInterval(timer);
  }, []);
  React.useEffect(() => {
    if (!externalConfirmOpen) return;
    externalConfirmTitleRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !externalEnqueueBusy) {
        setExternalConfirmOpen(false);
        window.setTimeout(() => externalConfirmOpenButtonRef.current?.focus());
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        externalConfirmRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [externalConfirmOpen, externalEnqueueBusy]);
  const generate = async () => {
    if (!workflowId || !promptText.trim()) return;
    setBusy(true);
    setError("");
    setGenerationNotice("");
    const refreshTimer = window.setInterval(() => void load(), 750);
    try {
      const result = await window.mangai.ai.generateImage({
        projectId: bundle.project.id,
        episodeId,
        pageId,
        workflowId,
        prompt: promptText,
        negativePrompt: negative,
        width: bundle.project.width,
        height: bundle.project.height,
        seed: Math.floor(Math.random() * 2147483647),
        jobType: safeHandoff?.type,
        libraryTags: safeHandoff?.tags,
      });
      if (result.bundle) onBundle(result.bundle);
      if (result.dimensionsAdjusted)
        setGenerationNotice(
          t("generation.runtimeAdjusted")
            .replace("{width}", String(result.effectiveWidth))
            .replace("{height}", String(result.effectiveHeight)),
        );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      await load();
    } finally {
      window.clearInterval(refreshTimer);
      setBusy(false);
    }
  };
  const selectedWorkflow = workflows.find(
    (workflow) => workflow.id === workflowId,
  );
  const episodePages = bundle.pages
    .filter((page) => page.episodeId === episodeId)
    .sort((left, right) => left.orderIndex - right.orderIndex);
  const batchEligibleCount = episodePages.filter((page) =>
    page.prompt.trim(),
  ).length;
  const batchSkippedCount = episodePages.length - batchEligibleCount;
  const enqueuePageBatch = async () => {
    if (!episodeId || !workflowId || !batchEligibleCount) return;
    setBatchBusy(true);
    setBatchMessage("");
    setError("");
    try {
      const result = await window.mangai.ai.enqueuePageBatch({
        projectId: bundle.project.id,
        episodeId,
        workflowId,
        pageIds: episodePages.map((page) => page.id),
      });
      setBatchMessage(
        t("generation.pageBatchQueued", {
          queued: result.queuedCount,
          skipped: result.skippedPageIds.length,
        }),
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBatchBusy(false);
    }
  };
  const resolveSafeAsset = async () => {
    if (!safeQuery.trim()) return;
    setSafeBusy(true);
    setError("");
    try {
      const result = await window.mangai.ai.resolveSafeAssetLibrary({
        projectId: bundle.project.id,
        pageId,
        type: safeType,
        query: safeQuery,
      });
      const urls = Object.fromEntries(
        await Promise.all(
          result.assets.map(async (asset) => [
            asset.id,
            await window.mangai.assetUrl(asset.relativePath),
          ]),
        ),
      );
      setSafeAssetUrls(urls);
      setSafeResult(result);
      if (result.decision.target !== "local" || result.decision.blocked)
        setSafeHandoff(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSafeBusy(false);
    }
  };
  const loadExternalModels = async () => {
    setExternalModelsBusy(true);
    setError("");
    setExternalPreview(null);
    try {
      const models = (await window.mangai.ai.listModels("dezgo")).filter(
        (model) => model.supportedFunctions?.includes("text_to_image"),
      );
      setExternalModels(models);
      setExternalModelId((current) =>
        models.some((model) => model.id === current)
          ? current
          : (models[0]?.id ?? ""),
      );
      if (!models.length) setError(t("generation.externalModelUnavailable"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setExternalModelsBusy(false);
    }
  };
  const enqueueExternal = async () => {
    if (!externalPreview?.executable) return;
    setExternalEnqueueBusy(true);
    setError("");
    try {
      await window.mangai.ai.enqueueExternalSafeAsset({
        previewId: externalPreview.previewId,
        promptSha256: externalPreview.promptSha256,
        payloadReviewed: true,
        costReviewed: true,
        providerTermsReviewed: true,
        confirmedAt: new Date().toISOString(),
      });
      setExternalConfirmOpen(false);
      setExternalChecks({ payload: false, cost: false, terms: false });
      setExternalQueueMessage(t("generation.externalQueued"));
      setExternalPreview(null);
      await load();
      window.setTimeout(() => externalQueueMessageRef.current?.focus());
    } catch (cause) {
      setExternalConfirmError(
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setExternalEnqueueBusy(false);
    }
  };
  return (
    <main className="tool-page">
      <header
        className="tool-header"
        inert={externalConfirmOpen}
        aria-hidden={externalConfirmOpen || undefined}
      >
        <button onClick={onClose}>{t("generation.backWorkspace")}</button>
        <h1>{t("generation.title")}</h1>
      </header>
      <div
        className="tool-content"
        inert={externalConfirmOpen}
        aria-hidden={externalConfirmOpen || undefined}
      >
        <ProjectGenerationPolicySettings
          projectId={bundle.project.id}
          onSaved={() => setExternalPreview(null)}
        />
        <section className="panel-lite safe-asset-resolver">
          <h2>{t("generation.safeAssetTitle")}</h2>
          <p>{t("generation.safeAssetDescription")}</p>
          <div className="inline">
            <select
              aria-label={t("generation.safeAssetType")}
              value={safeType}
              onChange={(event) => {
                setSafeType(
                  event.target.value as "background" | "prop" | "effect",
                );
                setExternalPreview(null);
                setExternalQueueMessage("");
              }}
            >
              <option value="background">
                {t("asset.category.background")}
              </option>
              <option value="prop">{t("asset.category.prop")}</option>
              <option value="effect">{t("asset.category.effect")}</option>
            </select>
            <input
              value={safeQuery}
              maxLength={500}
              placeholder={t("generation.safeAssetQuery")}
              aria-label={t("generation.safeAssetQuery")}
              onChange={(event) => {
                setSafeQuery(event.target.value);
                setExternalPreview(null);
                setExternalQueueMessage("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void resolveSafeAsset();
              }}
            />
            <button
              disabled={safeBusy || !safeQuery.trim()}
              onClick={() => void resolveSafeAsset()}
            >
              {safeBusy
                ? t("generation.safeAssetSearching")
                : t("generation.safeAssetSearch")}
            </button>
          </div>
          {safeResult && (
            <div className="safe-asset-result" role="status">
              <small>
                {t("generation.route")}:{" "}
                {t(routeTargetKey(safeResult.decision.target))}
                {" / "}
                {t("generation.routeReason")}:{" "}
                {t(routeReasonKey(safeResult.decision.reason))}
              </small>
              {safeResult.assets.length ? (
                <div className="safe-asset-grid">
                  {safeResult.assets.map((asset) => (
                    <button
                      key={asset.id}
                      title={asset.fileName}
                      onClick={() => onSelectAsset(asset.id)}
                    >
                      <img src={safeAssetUrls[asset.id]} alt="" />
                      <span>{asset.fileName}</span>
                      <small>{asset.libraryTags.join(" / ")}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="notice">
                  <p>
                    {safeResult.message ?? t("generation.safeAssetNoMatch")}
                  </p>
                  {safeResult.decision.target === "local" &&
                    !safeResult.decision.blocked && (
                      <button
                        className="secondary"
                        onClick={() => {
                          setPrompt(safeQuery);
                          setSafeHandoff({
                            type: safeType,
                            tags: splitLibraryTags(safeQuery),
                          });
                        }}
                      >
                        {t("generation.safeAssetHandoff")}
                      </button>
                    )}
                  <button
                    className="secondary"
                    disabled={externalModelsBusy}
                    onClick={() => void loadExternalModels()}
                  >
                    {externalModelsBusy
                      ? t("generation.externalModelsLoading")
                      : t("generation.externalModelsLoad")}
                  </button>
                  {externalModels.length > 0 && (
                    <select
                      aria-label={t("generation.externalModel")}
                      value={externalModelId}
                      onChange={(event) => {
                        setExternalModelId(event.target.value);
                        setExternalPreview(null);
                      }}
                    >
                      {externalModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    className="secondary"
                    disabled={externalPreviewBusy || !externalModelId}
                    onClick={async () => {
                      setExternalPreviewBusy(true);
                      try {
                        setExternalPreview(
                          await window.mangai.ai.previewExternalSafeAsset({
                            projectId: bundle.project.id,
                            pageId,
                            type: safeType,
                            query: safeQuery,
                            modelId: externalModelId,
                          }),
                        );
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : String(cause),
                        );
                      } finally {
                        setExternalPreviewBusy(false);
                      }
                    }}
                  >
                    {externalPreviewBusy
                      ? t("generation.externalPreviewLoading")
                      : t("generation.externalPreviewOpen")}
                  </button>
                </div>
              )}
            </div>
          )}
          {externalPreview && (
            <section className="external-dispatch-preview" role="region">
              <h3>{t("generation.externalPreviewTitle")}</h3>
              {externalPreview.blockReason && (
                <p className="notice">
                  {t(externalBlockReasonKey(externalPreview.blockReason))}
                </p>
              )}
              <dl>
                <div>
                  <dt>{t("generation.externalModel")}</dt>
                  <dd>
                    {externalPreview.modelName ?? externalPreview.modelId}
                  </dd>
                </div>
                <div>
                  <dt>{t("generation.externalProvider")}</dt>
                  <dd>{externalPreview.provider.displayName}</dd>
                </div>
                <div>
                  <dt>{t("generation.safeAssetType")}</dt>
                  <dd>
                    {t(`asset.category.${externalPreview.jobType}` as const)}
                  </dd>
                </div>
                <div>
                  <dt>{t("generation.externalPrompt")}</dt>
                  <dd>{t("generation.externalIncluded")}</dd>
                </div>
                <div>
                  <dt>{t("generation.externalNegativePrompt")}</dt>
                  <dd>{t("generation.externalNotIncluded")}</dd>
                </div>
                <div>
                  <dt>{t("generation.externalInputAssets")}</dt>
                  <dd>{externalPreview.manifest.inputAssetCount}</dd>
                </div>
                <div>
                  <dt>{t("generation.externalCharacterReference")}</dt>
                  <dd>{t("generation.externalNotIncluded")}</dd>
                </div>
                <div>
                  <dt>{t("generation.externalCompletedPage")}</dt>
                  <dd>{t("generation.externalNotIncluded")}</dd>
                </div>
                <div>
                  <dt>{t("generation.externalCost")}</dt>
                  <dd>
                    {externalPreview.estimatedCost === null
                      ? t("generation.externalUnknown")
                      : `${externalPreview.estimatedCost} ${externalPreview.currency}`}
                  </dd>
                </div>
                <div>
                  <dt>{t("generation.externalPricing")}</dt>
                  <dd>
                    {externalPreview.provider.providerId === "dezgo"
                      ? t("generation.externalDezgoPricing")
                      : externalPreview.provider.pricingSummary}
                  </dd>
                </div>
                <div>
                  <dt>{t("generation.externalRetention")}</dt>
                  <dd>
                    {externalPreview.provider.providerId === "dezgo"
                      ? t("generation.externalDezgoRetention")
                      : externalPreview.provider.dataRetentionSummary}
                  </dd>
                </div>
                <div>
                  <dt>{t("generation.externalTraining")}</dt>
                  <dd>
                    {externalPreview.provider.providerId === "dezgo"
                      ? t("generation.externalDezgoTraining")
                      : externalPreview.provider.trainingUseSummary}
                  </dd>
                </div>
                <div>
                  <dt>{t("generation.externalConfirmation")}</dt>
                  <dd>{t("generation.externalRequired")}</dd>
                </div>
              </dl>
              <p className="external-preview-warning">
                {t("generation.externalPreviewDisabled")}
              </p>
              {externalPreview.executable && (
                <button
                  ref={externalConfirmOpenButtonRef}
                  onClick={() => {
                    setExternalChecks({
                      payload: false,
                      cost: false,
                      terms: false,
                    });
                    setExternalConfirmError("");
                    setExternalConfirmOpen(true);
                  }}
                >
                  {t("generation.externalConfirmOpen")}
                </button>
              )}
            </section>
          )}
          {externalQueueMessage && (
            <p
              ref={externalQueueMessageRef}
              className="notice"
              role="status"
              tabIndex={-1}
            >
              {externalQueueMessage}
            </p>
          )}
        </section>
        <section className="panel-lite">
          <h2>{t("generation.nightQueueTitle")}</h2>
          <p>{t("generation.nightQueueHelp")}</p>
          <label className="check">
            <input
              type="checkbox"
              checked={queueSettings.nightModeEnabled}
              onChange={(event) =>
                setQueueSettings((value) => ({
                  ...value,
                  nightModeEnabled: event.target.checked,
                }))
              }
            />
            {t("generation.nightQueueEnabled")}
          </label>
          <div className="inline">
            <label>
              {t("generation.nightQueueStart")}
              <input
                type="time"
                value={queueSettings.startTime}
                onChange={(event) =>
                  setQueueSettings((value) => ({
                    ...value,
                    startTime: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              {t("generation.nightQueueEnd")}
              <input
                type="time"
                value={queueSettings.endTime}
                onChange={(event) =>
                  setQueueSettings((value) => ({
                    ...value,
                    endTime: event.target.value,
                  }))
                }
              />
            </label>
            <button
              onClick={async () => {
                setQueueSettings(
                  await window.mangai.ai.saveQueueSettings(queueSettings),
                );
                setQueueSettingsMessage(t("generation.nightQueueSaved"));
              }}
            >
              {t("generation.nightQueueSave")}
            </button>
          </div>
          {queueSettingsMessage && <p>{queueSettingsMessage}</p>}
        </section>
        <section className="panel-lite">
          <h2>{t("generation.comfyTitle")}</h2>
          {safeHandoff && (
            <div className="notice safe-handoff-notice" role="status">
              <span>
                {t("generation.safeAssetHandoffActive", {
                  type: t(`asset.category.${safeHandoff.type}` as const),
                })}
              </span>
              <button
                className="secondary"
                onClick={() => setSafeHandoff(null)}
              >
                {t("generation.safeAssetHandoffClear")}
              </button>
            </div>
          )}
          <div className="inline">
            <select
              aria-label={t("generation.workflowSelectAria")}
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
            >
              <option value="">{t("generation.selectWorkflow")}</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.isDefault ? "★ " : ""}
                  {w.name}
                </option>
              ))}
            </select>
            <button
              className="secondary"
              onClick={async () => {
                const name = prompt(
                  t("generation.workflowName"),
                  t("generation.defaultWorkflowName"),
                );
                if (name) {
                  const mappingText = prompt(
                    t("generation.mappingPrompt"),
                    '{"prompt":{"nodeId":"6","input":"text"},"negativePrompt":{"nodeId":"7","input":"text"},"width":{"nodeId":"5","input":"width"},"height":{"nodeId":"5","input":"height"},"seed":{"nodeId":"3","input":"seed"}}',
                  );
                  if (mappingText)
                    try {
                      setWorkflows(
                        await window.mangai.ai.addWorkflow(
                          name,
                          JSON.parse(mappingText),
                        ),
                      );
                    } catch (cause) {
                      setError(
                        cause instanceof Error ? cause.message : String(cause),
                      );
                    }
                }
              }}
            >
              {t("generation.addJson")}
            </button>
            <button
              className="danger"
              disabled={!workflowId}
              onClick={async () => {
                if (confirm(t("generation.deleteWorkflowConfirm"))) {
                  setWorkflows(
                    await window.mangai.ai.deleteWorkflow(workflowId),
                  );
                  setWorkflowId("");
                }
              }}
            >
              {t("generation.deleteSettings")}
            </button>
          </div>
          {selectedWorkflow && (
            <div className="workflow-tools">
              <div
                className={
                  selectedWorkflow.optimization?.lowSpecVaeReady
                    ? "notice"
                    : "error"
                }
                role="status"
              >
                <b>
                  {selectedWorkflow.optimization?.lowSpecVaeReady
                    ? t("generation.lowSpecVaeReady")
                    : t("generation.lowSpecVaeMissing")}
                </b>
                <p>{t("generation.cpuOffloadManualCheck")}</p>
              </div>
              <p>
                {t("generation.inputMapping")}:{" "}
                <code>{selectedWorkflow.mappingJson}</code>
              </p>
              <div className="inline">
                <button
                  className="secondary"
                  onClick={async () => {
                    const name = prompt(
                      t("generation.workflowName"),
                      selectedWorkflow.name,
                    );
                    if (!name) return;
                    const mappingText = prompt(
                      t("generation.mappingShort"),
                      selectedWorkflow.mappingJson,
                    );
                    if (!mappingText) return;
                    try {
                      setWorkflows(
                        await window.mangai.ai.updateWorkflow(
                          selectedWorkflow.id,
                          name,
                          JSON.parse(mappingText),
                        ),
                      );
                      setWorkflowMessage(t("generation.workflowUpdated"));
                    } catch (cause) {
                      setError(
                        cause instanceof Error ? cause.message : String(cause),
                      );
                    }
                  }}
                >
                  {t("generation.editWorkflow")}
                </button>
                <button
                  className="secondary"
                  disabled={Boolean(selectedWorkflow.isDefault)}
                  onClick={async () => {
                    setWorkflows(
                      await window.mangai.ai.setDefaultWorkflow(
                        selectedWorkflow.id,
                      ),
                    );
                    setWorkflowMessage(t("generation.defaultUpdated"));
                  }}
                >
                  {t("generation.setDefault")}
                </button>
                <button
                  className="secondary"
                  onClick={async () => {
                    const result = await window.mangai.ai.validateWorkflow(
                      selectedWorkflow.id,
                    );
                    setWorkflowMessage(result.message);
                  }}
                >
                  {t("generation.validateMapping")}
                </button>
                <button
                  className="secondary"
                  onClick={async () => {
                    const result = await window.mangai.ai.testWorkflow(
                      selectedWorkflow.id,
                    );
                    setWorkflowMessage(result.message);
                  }}
                >
                  {t("generation.testConnection")}
                </button>
              </div>
            </div>
          )}
          {workflowMessage && (
            <p className="notice" role="status">
              {workflowMessage}
            </p>
          )}
          <div className="notice" role="region">
            <h3>{t("generation.pageBatchTitle")}</h3>
            <p>{t("generation.pageBatchHelp")}</p>
            <p>
              {episodeId
                ? t("generation.pageBatchCount", {
                    eligible: batchEligibleCount,
                    skipped: batchSkippedCount,
                  })
                : t("generation.pageBatchNoEpisode")}
            </p>
            <button
              className="secondary"
              disabled={
                batchBusy ||
                !episodeId ||
                !workflowId ||
                batchEligibleCount === 0
              }
              onClick={() => void enqueuePageBatch()}
            >
              {batchBusy
                ? t("generation.pageBatchEnqueuing")
                : t("generation.pageBatchEnqueue")}
            </button>
            {batchMessage && <p role="status">{batchMessage}</p>}
          </div>
          <label>
            {t("generation.prompt")}
            <textarea
              value={promptText}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <label>
            {t("generation.negativePrompt")}
            <textarea
              value={negative}
              onChange={(e) => setNegative(e.target.value)}
            />
          </label>
          <button
            disabled={busy || !workflowId || !promptText.trim()}
            onClick={() => void generate()}
          >
            {busy ? t("generation.generating") : t("generation.start")}
          </button>
          {error && (
            <p className="error" role="alert">
              {localizeMessage(error)}
            </p>
          )}
          {generationNotice && <p>{generationNotice}</p>}
        </section>
        <section className="panel-lite">
          <h2>{t("generation.history")}</h2>
          <div className="job-list">
            {jobs.map((job) => {
              const route = routes.find((item) => item.jobId === job.id);
              const output = parseGenerationOutput(job.outputJson);
              const isDezgo = job.providerId === "dezgo";
              const outputSeed = output?.responseSeed ?? output?.requestedSeed;
              const outputAssetId = bundle.assets.some(
                (asset) => asset.id === output?.assetId,
              )
                ? output?.assetId
                : undefined;
              return (
                <article
                  key={job.id}
                  data-generation-status={job.status}
                  data-generation-provider={isDezgo ? "dezgo" : undefined}
                >
                  <div>
                    <b>
                      {job.providerType === "asset"
                        ? t("generation.assetLibrary")
                        : job.generationType === "image"
                          ? t("generation.image")
                          : t("generation.text")}{" "}
                      / {job.providerId}
                    </b>
                    <p>{job.prompt}</p>
                    <small>
                      {t(generationStatusKey(job.status))}・
                      {formatDateTime(job.createdAt)}
                    </small>
                    {job.generationType === "image" && job.attemptCount > 0 && (
                      <small>
                        {t("generation.attempt", {
                          current: job.attemptCount,
                          max: job.maxAttempts,
                        })}
                        {job.status === "queued" && job.nextAttemptAt
                          ? `・${t("generation.nextRetry", {
                              time: formatDateTime(job.nextAttemptAt),
                            })}`
                          : ""}
                      </small>
                    )}
                    {job.generationType === "image" && (
                      <div className="job-progress">
                        <progress
                          max="100"
                          value={Math.round((job.progress ?? 0) * 100)}
                        />
                        <small>
                          {Math.round((job.progress ?? 0) * 100)}%
                          {job.status === "running"
                            ? t("generation.progressEstimate")
                            : ""}
                        </small>
                      </div>
                    )}
                    {job.errorMessage && (
                      <p className="error" role="alert">
                        {localizeMessage(job.errorMessage)}
                      </p>
                    )}
                    {route && (
                      <div className="job-route">
                        <small>
                          {t("generation.route")}:{" "}
                          {t(routeTargetKey(route.decision.target))}
                          {" / "}
                          {t("generation.sensitivity")}:{" "}
                          {t(sensitivityKey(route.draft.sensitivity))}
                        </small>
                        <small>
                          {t("generation.routeReason")}:{" "}
                          {t(routeReasonKey(route.decision.reason))}
                          {route.decision.blocked
                            ? ` / ${t("generation.routeBlocked")}`
                            : ""}
                        </small>
                      </div>
                    )}
                    {isDezgo && output && job.status === "completed" && (
                      <dl
                        className="job-output-metadata"
                        aria-label={t("generation.resultDetails")}
                      >
                        <div>
                          <dt>{t("generation.resultModel")}</dt>
                          <dd>{job.modelId ?? output.model ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>{t("generation.resultCost")}</dt>
                          <dd>
                            {output.actualCostUsd === undefined
                              ? "—"
                              : formatUsd(output.actualCostUsd)}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("generation.resultBalance")}</dt>
                          <dd>
                            {output.balanceUsd === undefined
                              ? "—"
                              : formatUsd(output.balanceUsd)}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("generation.resultSeed")}</dt>
                          <dd>{outputSeed ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>{t("generation.resultDuration")}</dt>
                          <dd>
                            {output.durationMs === undefined
                              ? "—"
                              : formatDuration(output.durationMs)}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("generation.resultDimensions")}</dt>
                          <dd>
                            {output.width === undefined ||
                            output.height === undefined
                              ? "—"
                              : `${output.width} × ${output.height}`}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("generation.resultSteps")}</dt>
                          <dd>{output.steps ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>{t("generation.resultSampler")}</dt>
                          <dd>{output.sampler ?? "—"}</dd>
                        </div>
                      </dl>
                    )}
                  </div>
                  <div className="inline">
                    {job.status === "completed" &&
                      job.generationType === "image" && (
                        <button
                          className="secondary"
                          disabled={isDezgo && !outputAssetId}
                          title={
                            isDezgo && !outputAssetId
                              ? t("generation.assetUnavailable")
                              : undefined
                          }
                          onClick={() =>
                            outputAssetId
                              ? onSelectAsset(outputAssetId)
                              : onClose()
                          }
                        >
                          {t("generation.openAsset")}
                        </button>
                      )}
                    {job.status === "running" && (
                      <>
                        {job.generationType === "image" && (
                          <button
                            className="secondary"
                            onClick={() =>
                              window.mangai.ai.pauseJob(job.id).then(load)
                            }
                          >
                            {t("generation.pause")}
                          </button>
                        )}
                        <button
                          className="danger"
                          onClick={() =>
                            window.mangai.ai.cancel(job.id).then(load)
                          }
                        >
                          {t("generation.cancel")}
                        </button>
                      </>
                    )}
                    {["queued", "paused"].includes(job.status) &&
                      job.generationType === "image" && (
                        <>
                          <button
                            className="secondary"
                            aria-label={t("generation.priorityUp")}
                            onClick={() =>
                              window.mangai.ai
                                .changeJobPriority(job.id, 1)
                                .then(load)
                            }
                          >
                            ↑
                          </button>
                          <button
                            className="secondary"
                            aria-label={t("generation.priorityDown")}
                            onClick={() =>
                              window.mangai.ai
                                .changeJobPriority(job.id, -1)
                                .then(load)
                            }
                          >
                            ↓
                          </button>
                          {job.status === "queued" ? (
                            <button
                              className="secondary"
                              onClick={() =>
                                window.mangai.ai.pauseJob(job.id).then(load)
                              }
                            >
                              {t("generation.pause")}
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                window.mangai.ai.resumeJob(job.id).then(load)
                              }
                            >
                              {t("generation.resume")}
                            </button>
                          )}
                          <button
                            className="danger"
                            onClick={() =>
                              window.mangai.ai.cancel(job.id).then(load)
                            }
                          >
                            {t("generation.cancel")}
                          </button>
                        </>
                      )}
                    {job.status === "failed" &&
                      job.generationType === "image" && (
                        <button
                          onClick={async () => {
                            const input = JSON.parse(job.inputJson);
                            setBusy(true);
                            try {
                              const result =
                                await window.mangai.ai.generateImage(input);
                              if (result.bundle) onBundle(result.bundle);
                              await load();
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {t("generation.retry")}
                        </button>
                      )}
                  </div>
                </article>
              );
            })}
            {!jobs.length && (
              <div className="panel-empty">{t("generation.empty")}</div>
            )}
          </div>
        </section>
      </div>
      {externalConfirmOpen && externalPreview && (
        <div className="modal-backdrop" role="presentation">
          <section
            ref={externalConfirmRef}
            className="modal external-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="external-confirm-title"
          >
            <h2
              id="external-confirm-title"
              ref={externalConfirmTitleRef}
              tabIndex={-1}
            >
              {t("generation.externalConfirmTitle")}
            </h2>
            <p>{t("generation.externalConfirmWarning")}</p>
            {externalConfirmError && (
              <p className="error" role="alert">
                {localizeMessage(externalConfirmError)}
              </p>
            )}
            <dl className="dezgo-summary">
              <div>
                <dt>{t("generation.externalProvider")}</dt>
                <dd>{externalPreview.provider.displayName}</dd>
              </div>
              <div>
                <dt>{t("generation.externalModel")}</dt>
                <dd>{externalPreview.modelName ?? externalPreview.modelId}</dd>
              </div>
              <div>
                <dt>{t("generation.externalCost")}</dt>
                <dd>
                  {externalPreview.estimatedCost} {externalPreview.currency}
                </dd>
              </div>
            </dl>
            <label className="check">
              <input
                type="checkbox"
                checked={externalChecks.payload}
                onChange={(event) =>
                  setExternalChecks((value) => ({
                    ...value,
                    payload: event.target.checked,
                  }))
                }
              />
              {t("generation.externalConfirmPayload")}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={externalChecks.cost}
                onChange={(event) =>
                  setExternalChecks((value) => ({
                    ...value,
                    cost: event.target.checked,
                  }))
                }
              />
              {t("generation.externalConfirmCost")}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={externalChecks.terms}
                onChange={(event) =>
                  setExternalChecks((value) => ({
                    ...value,
                    terms: event.target.checked,
                  }))
                }
              />
              {t("generation.externalConfirmTerms")}
            </label>
            <footer>
              <button
                className="secondary"
                disabled={externalEnqueueBusy}
                onClick={() => {
                  setExternalConfirmOpen(false);
                  window.setTimeout(() =>
                    externalConfirmOpenButtonRef.current?.focus(),
                  );
                }}
              >
                {t("generation.externalConfirmCancel")}
              </button>
              <button
                disabled={
                  externalEnqueueBusy ||
                  !externalChecks.payload ||
                  !externalChecks.cost ||
                  !externalChecks.terms
                }
                onClick={() => void enqueueExternal()}
              >
                {externalEnqueueBusy
                  ? t("generation.externalQueueing")
                  : t("generation.externalConfirmQueue")}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
