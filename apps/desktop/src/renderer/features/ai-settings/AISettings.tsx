import React from "react";
import type {
  ProviderSettings,
  RuntimeProfileSelection,
  RuntimeProfileState,
} from "@mangai/ai-core";
import type {
  AISettingsHistoryItem,
  DiagnosticsState,
} from "../../../preload/api";
import { useI18n } from "../../i18n";
import { DezgoSettings } from "./DezgoSettings";
import { AdultGenerationSettings } from "./AdultGenerationSettings";

type PromptTemplate = {
  id: string;
  name: string;
  template: string;
  systemPrompt: string;
  isBuiltin: number;
};

type DiagnosticLevel = "running" | "success" | "warning" | "error";
type DiagnosticItem = {
  id: string;
  label: string;
  level: DiagnosticLevel;
  message: string;
};
type ComfyWorkflow = { id: string; name: string; isDefault: number };
type Translator = ReturnType<typeof useI18n>["t"];

const providerName = (
  id: ProviderSettings["providerId"],
  t: Translator,
) =>
  id === "ollama"
    ? "Ollama"
    : id === "comfyui"
      ? "ComfyUI"
      : t("settings.mock");

const diagnosticKey: Record<DiagnosticLevel, Parameters<Translator>[0]> = {
  running: "settings.status.running",
  success: "settings.status.success",
  warning: "settings.status.warning",
  error: "settings.status.error",
};
const runtimeProfileKey: Record<
  RuntimeProfileSelection,
  Parameters<Translator>[0]
> = {
  auto: "settings.runtime.auto",
  cpu_only: "settings.runtime.cpuOnly",
  vram_6gb: "settings.runtime.vram6",
  vram_8gb: "settings.runtime.vram8",
  vram_12gb: "settings.runtime.vram12",
  vram_16gb: "settings.runtime.vram16",
  vram_24gb_plus: "settings.runtime.vram24",
  remote_render: "settings.runtime.remote",
};
const providerFieldKey: Record<string, Parameters<Translator>[0]> = {
  providerId: "settings.provider.field.providerId",
  enabled: "settings.provider.field.enabled",
  baseUrl: "settings.provider.field.baseUrl",
  modelId: "settings.provider.field.modelId",
  temperature: "settings.provider.field.temperature",
  maxTokens: "settings.provider.field.maxTokens",
  timeoutMs: "settings.provider.field.timeoutMs",
  stream: "settings.provider.field.stream",
  pollIntervalMs: "settings.provider.field.pollIntervalMs",
  allowedOrigins: "settings.provider.field.allowedOrigins",
};

async function diagnoseComfyWorkflows(
  report: (item: DiagnosticItem) => void,
  t: Translator,
) {
  report({
    id: "comfyui-workflow",
    label: t("settings.aiDiagnostics.workflow"),
    level: "running",
    message: t("settings.aiDiagnostics.workflowChecking"),
  });
  try {
    const workflows =
      (await window.mangai.ai.listWorkflows()) as ComfyWorkflow[];
    if (!workflows.length) {
      report({
        id: "comfyui-workflow",
        label: t("settings.aiDiagnostics.workflow"),
        level: "warning",
        message: t("settings.aiDiagnostics.workflowMissing"),
      });
      return;
    }
    const results = await Promise.all(
      workflows.map(async (workflow) => ({
        workflow,
        result: await window.mangai.ai.validateWorkflow(workflow.id),
      })),
    );
    const invalid = results.filter((item) => !item.result.ok);
    const defaultWorkflow = workflows.find((workflow) => workflow.isDefault);
    report({
      id: "comfyui-workflow",
      label: t("settings.aiDiagnostics.workflow"),
      level: invalid.length || !defaultWorkflow ? "warning" : "success",
      message: invalid.length
        ? t("settings.aiDiagnostics.workflowInvalid", {
            count: workflows.length,
            invalid: invalid.length,
            names: invalid.map((item) => item.workflow.name).join(", "),
          })
        : !defaultWorkflow
          ? t("settings.aiDiagnostics.workflowNoDefault", {
              count: workflows.length,
            })
          : t("settings.aiDiagnostics.workflowReady", {
              count: workflows.length,
              name: defaultWorkflow.name,
            }),
    });
    if (defaultWorkflow) {
      const defaultResult = results.find(
        (item) => item.workflow.id === defaultWorkflow.id,
      )?.result;
      report({
        id: "comfyui-low-spec",
        label: t("settings.aiDiagnostics.lowSpecWorkflow"),
        level: defaultResult?.optimization.lowSpecVaeReady
          ? "success"
          : "warning",
        message: defaultResult?.optimization.lowSpecVaeReady
          ? t("settings.aiDiagnostics.lowSpecReady")
          : t("settings.aiDiagnostics.lowSpecMissing"),
      });
    }
    report({
      id: "comfyui-low-spec-runtime",
      label: t("settings.aiDiagnostics.runtime"),
      level: "running",
      message: t("settings.aiDiagnostics.runtimeChecking"),
    });
    try {
      const runtime = await window.mangai.ai.inspectComfyLowSpecRuntime(),
        device = runtime.devices[0],
        vram = device?.vramTotalBytes
          ? `${(device.vramTotalBytes / 1024 ** 3).toFixed(1)}GB`
          : t("settings.aiDiagnostics.unknown");
      report({
        id: "comfyui-low-spec-runtime",
        label: t("settings.aiDiagnostics.runtime"),
        level: runtime.runtimeChecksPassed ? "success" : "warning",
        message: [
          `ComfyUI ${runtime.comfyuiVersion ?? t("settings.aiDiagnostics.versionUnknown")}`,
          `GPU ${device?.name || t("settings.aiDiagnostics.gpuMissing")} / VRAM ${vram}`,
          runtime.tiledVaeNodeAvailable
            ? t("settings.aiDiagnostics.tiledAvailable")
            : t("settings.aiDiagnostics.tiledMissing"),
          runtime.cpuVaeEnabled
            ? t("settings.aiDiagnostics.cpuVaeEnabled")
            : t("settings.aiDiagnostics.cpuVaeMissing"),
          `VRAM mode: ${runtime.lowVramMode}`,
          runtime.reserveVramGb === null
            ? t("settings.aiDiagnostics.reserveNone")
            : t("settings.aiDiagnostics.reserve", {
                value: runtime.reserveVramGb,
              }),
        ].join(" / "),
      });
    } catch (cause) {
      report({
        id: "comfyui-low-spec-runtime",
        label: t("settings.aiDiagnostics.runtime"),
        level: "error",
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  } catch (cause) {
    report({
      id: "comfyui-workflow",
      label: t("settings.aiDiagnostics.workflow"),
      level: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

export function AISettings({ onClose }: { onClose: () => void }) {
  const { locale, setLocale, t, localizeMessage, formatDateTime } = useI18n();
  const [settings, setSettings] = React.useState<ProviderSettings[]>([]),
    [models, setModels] = React.useState<
      Record<
        string,
        Array<{ id: string; name: string; cached?: boolean; license?: string }>
      >
    >({}),
    [status, setStatus] = React.useState<Record<string, string>>({}),
    [paths, setPaths] = React.useState<any>(),
    [templates, setTemplates] = React.useState<PromptTemplate[]>([]),
    [editingTemplateId, setEditingTemplateId] = React.useState<string | null>(
      null,
    ),
    [templateName, setTemplateName] = React.useState(""),
    [templateBody, setTemplateBody] = React.useState(""),
    [templateSystemPrompt, setTemplateSystemPrompt] = React.useState(""),
    [diagnostics, setDiagnostics] = React.useState<DiagnosticItem[]>([]),
    [diagnosing, setDiagnosing] = React.useState(false),
    [diagnosedAt, setDiagnosedAt] = React.useState<Date | null>(null),
    [diagnosticsState, setDiagnosticsState] =
      React.useState<DiagnosticsState | null>(null),
    [diagnosticsMessage, setDiagnosticsMessage] = React.useState("");
  const [runtimeProfile, setRuntimeProfile] =
    React.useState<RuntimeProfileState | null>(null);
  const [runtimeMessage, setRuntimeMessage] = React.useState("");
  const [settingsHistory, setSettingsHistory] = React.useState<
    AISettingsHistoryItem[]
  >([]);
  const load = () =>
    Promise.all([
      window.mangai.ai.listSettings().then(setSettings),
      window.mangai.getPaths().then(setPaths),
      window.mangai.ai.listTemplates().then(setTemplates),
      window.mangai.diagnostics.getState().then(setDiagnosticsState),
      window.mangai.ai.listSettingsHistory().then(setSettingsHistory),
      window.mangai.ai
        .runtimeInfo()
        .then((value) => setRuntimeProfile(value.runtimeProfile)),
    ]);
  React.useEffect(() => {
    void load();
  }, []);
  const update = (id: string, patch: Partial<ProviderSettings>) =>
    setSettings((values) =>
      values.map((value) =>
        value.providerId === id ? { ...value, ...patch } : value,
      ),
    );
  const save = async (value: ProviderSettings) => {
    await window.mangai.ai.saveSettings(value);
    setSettingsHistory(await window.mangai.ai.listSettingsHistory());
    setStatus((s) => ({
      ...s,
      [value.providerId]: t("settings.provider.saved"),
    }));
  };
  const check = async (value: ProviderSettings) => {
    await save(value);
    setStatus((s) => ({
      ...s,
      [value.providerId]: t("settings.provider.checking"),
    }));
    try {
      const result = await window.mangai.ai.checkProvider(value.providerId);
      setStatus((s) => ({ ...s, [value.providerId]: result.message }));
      if (result.ok && value.providerId !== "comfyui")
        setModels((m) => ({ ...m, [value.providerId]: [] }));
    } catch (error) {
      setStatus((s) => ({
        ...s,
        [value.providerId]:
          error instanceof Error ? error.message : String(error),
      }));
    }
  };
  const runDiagnostics = async () => {
    const providers = settings.filter((value) => value.providerId !== "mock");
    const report = (item: DiagnosticItem) =>
      setDiagnostics((items) => [
        ...items.filter((current) => current.id !== item.id),
        item,
      ]);
    setDiagnosing(true);
    setDiagnosedAt(null);
    setDiagnostics(
      providers.map((value) => ({
        id: `${value.providerId}-connection`,
        label: t("settings.aiDiagnostics.connection", {
          name: providerName(value.providerId, t),
        }),
        level: "running",
        message: t("settings.aiDiagnostics.configChecking"),
      })),
    );
    try {
      for (const value of providers) {
        const name = providerName(value.providerId, t);
        try {
          await window.mangai.ai.saveSettings(value);
        } catch (cause) {
          report({
            id: `${value.providerId}-connection`,
            label: t("settings.aiDiagnostics.settingsLabel", { name }),
            level: "error",
            message: t("settings.aiDiagnostics.saveFailed", {
              message: cause instanceof Error ? cause.message : String(cause),
            }),
          });
          continue;
        }
        if (!value.enabled) {
          report({
            id: `${value.providerId}-connection`,
            label: t("settings.aiDiagnostics.connection", { name }),
            level: "warning",
            message: t("settings.aiDiagnostics.disabled", { name }),
          });
          continue;
        }
        let connected = false;
        try {
          const result = await window.mangai.ai.checkProvider(value.providerId);
          connected = result.ok;
          report({
            id: `${value.providerId}-connection`,
            label: t("settings.aiDiagnostics.connection", { name }),
            level: result.ok ? "success" : "error",
            message: `${result.message}${
              result.latencyMs !== undefined
                ? t("settings.aiDiagnostics.response", {
                    value: result.latencyMs,
                  })
                : ""
            }`,
          });
        } catch (cause) {
          report({
            id: `${value.providerId}-connection`,
            label: t("settings.aiDiagnostics.connection", { name }),
            level: "error",
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
        if (value.providerId === "comfyui")
          await diagnoseComfyWorkflows(report, t);
        if (value.providerId !== "ollama" || !connected) continue;
        report({
          id: "ollama-model",
          label: t("settings.aiDiagnostics.ollamaModel"),
          level: "running",
          message: t("settings.aiDiagnostics.modelsChecking"),
        });
        try {
          const list = await window.mangai.ai.listModels("ollama");
          setModels((current) => ({ ...current, ollama: list }));
          const selected = list.find((model) => model.id === value.modelId);
          const cached = list.some((model) => model.cached);
          report({
            id: "ollama-model",
            label: t("settings.aiDiagnostics.ollamaModel"),
            level:
              !list.length || (value.modelId && !selected)
                ? "error"
                : !value.modelId || cached
                  ? "warning"
                  : "success",
            message: !list.length
              ? t("settings.aiDiagnostics.modelsMissing")
              : !value.modelId
                ? t("settings.aiDiagnostics.modelSelect", {
                    count: list.length,
                  })
                : !selected
                  ? t("settings.aiDiagnostics.modelMissing", {
                      name: value.modelId,
                    })
                  : cached
                    ? t("settings.aiDiagnostics.modelCached", {
                        name: selected.name,
                      })
                    : t("settings.aiDiagnostics.modelReady", {
                        name: selected.name,
                      }),
          });
        } catch (cause) {
          report({
            id: "ollama-model",
            label: t("settings.aiDiagnostics.ollamaModel"),
            level: "error",
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
      }
    } finally {
      setDiagnosing(false);
      setDiagnosedAt(new Date());
    }
  };
  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateBody("");
    setTemplateSystemPrompt("");
  };
  const fillTemplateForm = (template: PromptTemplate, duplicate: boolean) => {
    setEditingTemplateId(duplicate ? null : template.id);
    setTemplateName(
      duplicate
        ? t("settings.templates.copyName", { name: template.name })
        : template.name,
    );
    setTemplateBody(template.template);
    setTemplateSystemPrompt(template.systemPrompt);
  };
  return (
    <main className="tool-page">
      <header className="tool-header">
        <button onClick={onClose}>{t("settings.backWorkspace")}</button>
        <h1>{t("nav.settings")}</h1>
      </header>
      <div className="tool-content">
        <section className="panel-lite">
          <h2>{t("settings.general")}</h2>
          <label>
            {t("settings.language")}
            <select
              data-a11y-field="locale"
              value={locale}
              onChange={(event) =>
                setLocale(event.target.value === "en" ? "en" : "ja")
              }
            >
              <option value="ja">{t("settings.japanese")}</option>
              <option value="en">{t("settings.english")}</option>
            </select>
            <small>{t("settings.languageHelp")}</small>
          </label>
          <p>
            {t("settings.dataLocation", {
              path: paths?.root ?? t("settings.loading"),
            })}
          </p>
          <p>{t("settings.aiLogPrivacy")}</p>
        </section>
        <section
          className="panel-lite"
          aria-labelledby="runtime-profile-title"
        >
          <div className="setting-title">
            <div>
              <h2 id="runtime-profile-title">
                {t("settings.runtime.title")}
              </h2>
              <p>{t("settings.runtime.description")}</p>
            </div>
            <span className="hub-readonly-badge">
              {runtimeProfile
                ? t(runtimeProfileKey[runtimeProfile.effectiveProfile])
                : t("settings.runtime.checking")}
            </span>
          </div>
          {runtimeProfile && (
            <>
              <p>
                RAM:{" "}
                {(runtimeProfile.hardware.totalRamBytes / 1024 ** 3).toFixed(1)}{" "}
                GB / GPU:{" "}
                {runtimeProfile.hardware.gpuName ??
                  t("settings.runtime.gpuMissing")}{" "}
                / VRAM:{" "}
                {runtimeProfile.hardware.dedicatedVramMb
                  ? `${Math.round(runtimeProfile.hardware.dedicatedVramMb / 1024)} GB`
                  : t("settings.runtime.unknown")}
              </p>
              <label>
                {t("settings.runtime.profile")}
                <select
                  value={runtimeProfile.selection}
                  onChange={async (event) => {
                    const selection = event.target
                      .value as RuntimeProfileSelection;
                    const saved =
                      await window.mangai.ai.saveRuntimeProfile(selection);
                    setRuntimeProfile(saved);
                    setRuntimeMessage(t("settings.runtime.saved"));
                  }}
                >
                  {Object.entries(runtimeProfileKey).map(([value, key]) => (
                    <option key={value} value={value}>
                      {t(key)}
                    </option>
                  ))}
                </select>
                <small>
                  {t("settings.runtime.recommended", {
                    profile: t(
                      runtimeProfileKey[runtimeProfile.recommendedProfile],
                    ),
                  })}
                  {" · "}
                  {t("settings.runtime.constraints")}
                </small>
              </label>
              {!runtimeProfile.limits.localImageGenerationRecommended && (
                <p className="diagnostic-empty">
                  {t("settings.runtime.notRecommended")}
                </p>
              )}
              {runtimeMessage && (
                <p role="status" aria-live="polite">
                  {localizeMessage(runtimeMessage)}
                </p>
              )}
            </>
          )}
        </section>
        <section
          className="panel-lite diagnostics-privacy"
          aria-labelledby="diagnostics-privacy-title"
        >
          <div className="setting-title">
            <div>
              <h2 id="diagnostics-privacy-title">
                {t("settings.privacy.title")}
              </h2>
              <p>{t("settings.privacy.description")}</p>
            </div>
            <span className="hub-readonly-badge">
              {diagnosticsState?.externalUploadAvailable
                ? t("settings.privacy.manualUpload")
                : t("settings.privacy.uploadUnavailable")}
            </span>
          </div>
          <label className="check diagnostics-consent">
            <input
              type="checkbox"
              checked={diagnosticsState?.detailedCrashReportsEnabled ?? false}
              disabled={!diagnosticsState}
              onChange={async (event) => {
                setDiagnosticsMessage("");
                try {
                  setDiagnosticsState(
                    await window.mangai.diagnostics.setConsent(
                      event.target.checked,
                    ),
                  );
                  setDiagnosticsMessage(
                    t("settings.privacy.localConsentSaved"),
                  );
                } catch (cause) {
                  setDiagnosticsMessage(
                    cause instanceof Error ? cause.message : String(cause),
                  );
                }
              }}
            />
            {t("settings.privacy.localConsent")}
          </label>
          <p className="diagnostic-empty">
            {t("settings.privacy.localHelp")}
          </p>
          <label className="check diagnostics-consent">
            <input
              type="checkbox"
              checked={diagnosticsState?.externalUploadEnabled ?? false}
              disabled={
                !diagnosticsState?.externalUploadAvailable ||
                !diagnosticsState?.detailedCrashReportsEnabled
              }
              onChange={async (event) => {
                setDiagnosticsMessage("");
                try {
                  setDiagnosticsState(
                    await window.mangai.diagnostics.setUploadConsent(
                      event.target.checked,
                    ),
                  );
                  setDiagnosticsMessage(
                    t("settings.privacy.uploadConsentSaved"),
                  );
                } catch (cause) {
                  setDiagnosticsMessage(
                    cause instanceof Error ? cause.message : String(cause),
                  );
                }
              }}
            />
            {t("settings.privacy.uploadConsent")}
          </label>
          <p className="diagnostic-empty">
            {t("settings.privacy.uploadHelp")}
          </p>
          <div className="diagnostics-storage">
            <p>
              <b>{t("settings.privacy.logDirectory")}</b>{" "}
              {diagnosticsState?.logDirectory ??
                t("settings.privacy.loading")}
            </p>
            <p>
              <b>{t("settings.privacy.crashReports")}</b>{" "}
              {t("settings.privacy.items", {
                count: diagnosticsState?.crashReportCount ?? 0,
              })}
            </p>
            <p>
              <b>{t("settings.privacy.pendingUploads")}</b>{" "}
              {t("settings.privacy.items", {
                count: diagnosticsState?.pendingUploadCount ?? 0,
              })}
            </p>
            <p>
              <b>{t("settings.privacy.lastUpload")}</b>{" "}
              {diagnosticsState?.lastUploadAt
                ? formatDateTime(diagnosticsState.lastUploadAt)
                : t("settings.privacy.neverUploaded")}
            </p>
          </div>
          <div className="inline">
            <button
              className="secondary"
              onClick={async () => {
                setDiagnosticsMessage("");
                try {
                  await window.mangai.diagnostics.openLogs();
                } catch (cause) {
                  setDiagnosticsMessage(
                    cause instanceof Error ? cause.message : String(cause),
                  );
                }
              }}
            >
              {t("settings.privacy.openLogs")}
            </button>
            <button
              className="secondary"
              disabled={!diagnosticsState?.crashReportCount}
              onClick={async () => {
                if (!confirm(t("settings.privacy.deleteConfirm")))
                  return;
                try {
                  setDiagnosticsState(
                    await window.mangai.diagnostics.clearCrashReports(),
                  );
                  setDiagnosticsMessage(t("settings.privacy.deleted"));
                } catch (cause) {
                  setDiagnosticsMessage(
                    cause instanceof Error ? cause.message : String(cause),
                  );
                }
              }}
            >
              {t("settings.privacy.delete")}
            </button>
            <button
              className="secondary"
              disabled={
                !diagnosticsState?.externalUploadEnabled ||
                !diagnosticsState?.pendingUploadCount
              }
              onClick={async () => {
                if (
                  !confirm(
                    t("settings.privacy.uploadConfirm", {
                      count: diagnosticsState?.pendingUploadCount ?? 0,
                    }),
                  )
                )
                  return;
                setDiagnosticsMessage("");
                try {
                  setDiagnosticsState(
                    await window.mangai.diagnostics.uploadPending(),
                  );
                  setDiagnosticsMessage(t("settings.privacy.uploaded"));
                } catch (cause) {
                  setDiagnosticsState(
                    await window.mangai.diagnostics.getState(),
                  );
                  setDiagnosticsMessage(
                    cause instanceof Error ? cause.message : String(cause),
                  );
                }
              }}
            >
              {t("settings.privacy.upload")}
            </button>
          </div>
          {diagnosticsMessage && (
            <p className="notice" role="status" aria-live="polite">
              {localizeMessage(diagnosticsMessage)}
            </p>
          )}
        </section>
        <section
          className="panel-lite ai-diagnostics"
          aria-labelledby="ai-diagnostics-title"
          aria-busy={diagnosing}
        >
          <div className="setting-title">
            <div>
              <h2 id="ai-diagnostics-title">
                {t("settings.aiDiagnostics.title")}
              </h2>
              <p id="ai-diagnostics-description">
                {t("settings.aiDiagnostics.description")}
              </p>
            </div>
            <button
              disabled={diagnosing}
              aria-describedby="ai-diagnostics-description"
              onClick={() => void runDiagnostics()}
            >
              {diagnosing
                ? t("settings.aiDiagnostics.running")
                : t("settings.aiDiagnostics.run")}
            </button>
          </div>
          {!diagnostics.length ? (
            <p className="diagnostic-empty">
              {t("settings.aiDiagnostics.help")}
            </p>
          ) : (
            <div className="diagnostic-list" aria-live="polite">
              {diagnostics.map((item) => (
                <article
                  className={`diagnostic-item ${item.level}`}
                  key={item.id}
                >
                  <span>{t(diagnosticKey[item.level])}</span>
                  <div>
                    <b>{item.label}</b>
                    <p>{localizeMessage(item.message)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
          {diagnosedAt && !diagnosing && (
            <small>
              {t("settings.aiDiagnostics.lastRun", {
                value: diagnosedAt.toLocaleString(
                  locale === "ja" ? "ja-JP" : "en-US",
                ),
              })}
            </small>
          )}
        </section>
        <section className="panel-lite">
          <div className="setting-title">
            <div>
              <h2>{t("settings.provider.historyTitle")}</h2>
              <p>{t("settings.provider.historyDescription")}</p>
            </div>
            <span className="hub-readonly-badge">
              {t("settings.provider.auditHistory")}
            </span>
          </div>
          {!settingsHistory.length ? (
            <p className="diagnostic-empty">
              {t("settings.provider.historyEmpty")}
            </p>
          ) : (
            <div className="job-list">
              {settingsHistory.slice(0, 10).map((item) => (
                <article key={item.id}>
                  <div>
                    <b>{providerName(item.providerId, t)}</b>
                    <p>
                      {item.summary.enabled
                        ? t("settings.provider.enabledState")
                        : t("settings.provider.disabledState")}
                      {" · "}
                      {item.summary.endpointKind === "local"
                        ? t("settings.provider.localEndpoint")
                        : t("settings.provider.remoteEndpoint")}
                      {" · "}
                      {t("settings.provider.changed", {
                        fields: item.changedFields
                          .map((field) =>
                            providerFieldKey[field]
                              ? t(providerFieldKey[field])
                              : field,
                          )
                          .join(", "),
                      })}
                    </p>
                    <small>{formatDateTime(item.createdAt)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <DezgoSettings />
        <AdultGenerationSettings />
        {settings.map((value) => (
          <section className="panel-lite" key={value.providerId}>
            <div className="setting-title">
              <h2>
                {value.providerId === "ollama"
                  ? "Ollama"
                  : value.providerId === "comfyui"
                    ? "ComfyUI"
                    : t("settings.provider.mock")}
              </h2>
              <label className="check">
                <input
                  type="checkbox"
                  checked={value.enabled}
                  onChange={(e) =>
                    update(value.providerId, { enabled: e.target.checked })
                  }
                />
                {t("settings.provider.enabled")}
              </label>
            </div>
            <label>
              {t("settings.provider.baseUrl")}
              <input
                value={value.baseUrl}
                onChange={(e) =>
                  update(value.providerId, { baseUrl: e.target.value })
                }
              />
            </label>
            <label>
              {t("settings.provider.allowedOrigins")}
              <textarea
                value={value.allowedOrigins.join("\n")}
                onChange={(e) =>
                  update(value.providerId, {
                    allowedOrigins: e.target.value
                      .split(/\r?\n/)
                      .map((origin) => origin.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="https://ai.example.com:8188"
              />
              <small>{t("settings.provider.allowedOriginsHelp")}</small>
            </label>
            {value.providerId !== "comfyui" && (
              <>
                <label>
                  {t("settings.provider.model")}
                  <select
                    value={value.modelId}
                    onChange={(e) =>
                      update(value.providerId, { modelId: e.target.value })
                    }
                  >
                    <option value="">
                      {t("settings.provider.selectModel")}
                    </option>
                    {models[value.providerId]?.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </label>
                {value.modelId && (
                  <div className="notice" role="note">
                    <b>{t("settings.provider.modelLicense")}</b>{" "}
                    {models[value.providerId]?.find(
                      (model) => model.id === value.modelId,
                    )?.license ?? t("settings.provider.licenseUnverified")}
                    <p>{t("settings.provider.licenseResponsibility")}</p>
                  </div>
                )}
                <div className="grid">
                  <label>
                    Temperature
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={value.temperature}
                      onChange={(e) =>
                        update(value.providerId, {
                          temperature: +e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    {t("settings.provider.maxTokens")}
                    <input
                      type="number"
                      value={value.maxTokens}
                      onChange={(e) =>
                        update(value.providerId, { maxTokens: +e.target.value })
                      }
                    />
                  </label>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={value.stream}
                    onChange={(e) =>
                      update(value.providerId, { stream: e.target.checked })
                    }
                  />
                  {t("settings.provider.streaming")}
                </label>
              </>
            )}
            <div className="grid">
              <label>
                {t("settings.provider.timeout")}
                <input
                  type="number"
                  value={value.timeoutMs}
                  onChange={(e) =>
                    update(value.providerId, { timeoutMs: +e.target.value })
                  }
                />
              </label>
              {value.providerId === "comfyui" && (
                <label>
                  {t("settings.provider.pollInterval")}
                  <input
                    type="number"
                    value={value.pollIntervalMs}
                    onChange={(e) =>
                      update(value.providerId, {
                        pollIntervalMs: +e.target.value,
                      })
                    }
                  />
                </label>
              )}
            </div>
            <div className="inline">
              <button onClick={() => save(value)}>
                {t("settings.provider.save")}
              </button>
              <button className="secondary" onClick={() => check(value)}>
                {t("settings.provider.check")}
              </button>
              {value.providerId !== "comfyui" && (
                <button
                  className="secondary"
                  onClick={async () => {
                    await save(value);
                    const list = await window.mangai.ai.listModels(
                      value.providerId,
                    );
                    setModels((m) => ({ ...m, [value.providerId]: list }));
                    setStatus((s) => ({
                      ...s,
                      [value.providerId]: t(
                        "settings.provider.modelsLoaded",
                        {
                          count: list.length,
                          cache: list.some((model) => model.cached)
                            ? t("settings.provider.modelsCached")
                            : "",
                        },
                      ),
                    }));
                  }}
                >
                  {t("settings.provider.refreshModels")}
                </button>
              )}
            </div>
            {status[value.providerId] && (
              <p className="notice" role="status" aria-live="polite">
                {localizeMessage(status[value.providerId])}
              </p>
            )}
          </section>
        ))}
        <section className="panel-lite">
          <h2>{t("settings.templates.title")}</h2>
          <p>{t("settings.templates.description")}</p>
          <div className="grid">
            <label>
              {t("settings.templates.name")}
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </label>
            <label>
              {t("settings.templates.body")}
              <textarea
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
              />
            </label>
            <label>
              {t("settings.templates.systemPrompt")}
              <textarea
                value={templateSystemPrompt}
                onChange={(e) => setTemplateSystemPrompt(e.target.value)}
              />
            </label>
          </div>
          <div className="inline">
            <button
              disabled={!templateName.trim() || !templateBody.trim()}
              onClick={async () => {
                setTemplates(
                  await window.mangai.ai.saveTemplate({
                    id: editingTemplateId ?? undefined,
                    name: templateName,
                    template: templateBody,
                    systemPrompt: templateSystemPrompt,
                  }),
                );
                resetTemplateForm();
              }}
            >
              {editingTemplateId
                ? t("settings.templates.saveChanges")
                : t("settings.templates.add")}
            </button>
            {editingTemplateId && (
              <button className="secondary" onClick={resetTemplateForm}>
                {t("settings.templates.cancelEdit")}
              </button>
            )}
          </div>
          <div className="job-list">
            {templates.map((template) => (
              <article key={template.id}>
                <div>
                  <b>
                    {template.name}{" "}
                    {template.isBuiltin
                      ? t("settings.templates.builtin")
                      : ""}
                  </b>
                  <p>{template.template}</p>
                  {template.systemPrompt && (
                    <p>
                      {t("settings.templates.systemLabel")}{" "}
                      {template.systemPrompt}
                    </p>
                  )}
                </div>
                <div className="inline">
                  <button
                    className="secondary"
                    onClick={() => fillTemplateForm(template, true)}
                  >
                    {t("settings.templates.duplicate")}
                  </button>
                  {!template.isBuiltin && (
                    <>
                      <button
                        className="secondary"
                        onClick={() => fillTemplateForm(template, false)}
                      >
                        {t("settings.templates.edit")}
                      </button>
                      <button
                        className="danger"
                        onClick={async () => {
                          if (
                            !confirm(
                              t("settings.templates.deleteConfirm", {
                                name: template.name,
                              }),
                            )
                          )
                            return;
                          setTemplates(
                            await window.mangai.ai.deleteTemplate(template.id),
                          );
                          if (editingTemplateId === template.id)
                            resetTemplateForm();
                        }}
                      >
                        {t("settings.templates.delete")}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
