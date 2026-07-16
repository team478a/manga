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
  const { locale, setLocale, t } = useI18n();
  const [settings, setSettings] = React.useState<ProviderSettings[]>([]),
    [models, setModels] = React.useState<
      Record<string, Array<{ id: string; name: string; cached?: boolean }>>
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
    setStatus((s) => ({ ...s, [value.providerId]: "保存しました。" }));
  };
  const check = async (value: ProviderSettings) => {
    await save(value);
    setStatus((s) => ({ ...s, [value.providerId]: "接続確認中…" }));
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
    setTemplateName(duplicate ? `${template.name} のコピー` : template.name);
    setTemplateBody(template.template);
    setTemplateSystemPrompt(template.systemPrompt);
  };
  return (
    <main className="tool-page">
      <header className="tool-header">
        <button onClick={onClose}>← ワークスペース</button>
        <h1>{t("nav.settings")}</h1>
      </header>
      <div className="tool-content">
        <section className="panel-lite">
          <h2>{t("settings.general")}</h2>
          <label>
            {t("settings.language")}
            <select
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
          <p>データ保存先: {paths?.root ?? "読み込み中"}</p>
          <p>AIログには秘密情報を保存しません。クラウドAPIキーは未対応です。</p>
        </section>
        <section className="panel-lite">
          <div className="setting-title">
            <div>
              <h2>端末性能とRuntime Profile</h2>
              <p>
                起動時にRAMとGPUメモリを診断し、ローカル生成の安全な初期値を選びます。
              </p>
            </div>
            <span className="hub-readonly-badge">
              {runtimeProfile
                ? t(runtimeProfileKey[runtimeProfile.effectiveProfile])
                : "診断中"}
            </span>
          </div>
          {runtimeProfile && (
            <>
              <p>
                RAM: {(runtimeProfile.hardware.totalRamBytes / 1024 ** 3).toFixed(1)} GB
                ／ GPU: {runtimeProfile.hardware.gpuName ?? "未検出"}
                ／ VRAM: {runtimeProfile.hardware.dedicatedVramMb
                  ? `${Math.round(runtimeProfile.hardware.dedicatedVramMb / 1024)} GB`
                  : "不明"}
              </p>
              <label>
                使用プロファイル
                <select
                  value={runtimeProfile.selection}
                  onChange={async (event) => {
                    const selection = event.target
                      .value as RuntimeProfileSelection;
                    const saved =
                      await window.mangai.ai.saveRuntimeProfile(selection);
                    setRuntimeProfile(saved);
                    setRuntimeMessage("端末設定へ保存しました。");
                  }}
                >
                  {Object.entries(runtimeProfileKey).map(([value, key]) => (
                    <option key={value} value={value}>
                      {t(key)}
                    </option>
                  ))}
                </select>
                <small>
                  推奨: {t(runtimeProfileKey[runtimeProfile.recommendedProfile])}
                  ／ バッチ1・ローカル生成の同時実行1件
                </small>
              </label>
              {!runtimeProfile.limits.localImageGenerationRecommended && (
                <p className="diagnostic-empty">
                  GPUを確認できないため、ローカル画像生成は非推奨です。編集・素材利用・背景APIは引き続き使用できます。
                </p>
              )}
              {runtimeMessage && <p>{runtimeMessage}</p>}
            </>
          )}
        </section>
        <section className="panel-lite diagnostics-privacy">
          <div className="setting-title">
            <div>
              <h2>診断データとプライバシー</h2>
              <p>
                動作ログは端末内だけに保存し、秘密値とホームフォルダーを除外します。詳細レポートの外部送信には別の同意と手動操作が必要です。
              </p>
            </div>
            <span className="hub-readonly-badge">
              {diagnosticsState?.externalUploadAvailable
                ? "手動送信"
                : "送信先未設定"}
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
                  setDiagnosticsMessage("診断データ設定を保存しました。");
                } catch (cause) {
                  setDiagnosticsMessage(
                    cause instanceof Error ? cause.message : String(cause),
                  );
                }
              }}
            />
            詳細なクラッシュレポートを端末内へ保存することに同意する
          </label>
          <p className="diagnostic-empty">
            OFFの場合も、起動・終了・エラー種別を含む最小限のJSONL動作ログは端末内へ保存します。ONの場合だけ、エラー内容とスタックを含む詳細ファイルを最大20件保存します。
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
                  setDiagnosticsMessage("外部送信の同意設定を保存しました。");
                } catch (cause) {
                  setDiagnosticsMessage(
                    cause instanceof Error ? cause.message : String(cause),
                  );
                }
              }}
            />
            詳細クラッシュレポートを外部へ送信することに同意する
          </label>
          <p className="diagnostic-empty">
            ローカル保存への同意とは別に管理します。自動送信はせず、下の「未送信分を送信」を選んだ場合だけ送信します。
          </p>
          <div className="diagnostics-storage">
            <p>
              <b>ログ保存先:</b>{" "}
              {diagnosticsState?.logDirectory ?? "読み込み中"}
            </p>
            <p>
              <b>詳細クラッシュレポート:</b>{" "}
              {diagnosticsState?.crashReportCount ?? 0}件
            </p>
            <p>
              <b>外部へ未送信:</b> {diagnosticsState?.pendingUploadCount ?? 0}件
            </p>
            <p>
              <b>最終送信:</b>{" "}
              {diagnosticsState?.lastUploadAt
                ? new Date(diagnosticsState.lastUploadAt).toLocaleString()
                : "未送信"}
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
              ログフォルダーを開く
            </button>
            <button
              className="secondary"
              disabled={!diagnosticsState?.crashReportCount}
              onClick={async () => {
                if (!confirm("端末内の詳細クラッシュレポートを削除しますか？"))
                  return;
                try {
                  setDiagnosticsState(
                    await window.mangai.diagnostics.clearCrashReports(),
                  );
                  setDiagnosticsMessage(
                    "詳細クラッシュレポートを削除しました。",
                  );
                } catch (cause) {
                  setDiagnosticsMessage(
                    cause instanceof Error ? cause.message : String(cause),
                  );
                }
              }}
            >
              詳細レポートを削除
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
                    `${diagnosticsState?.pendingUploadCount ?? 0}件の詳細クラッシュレポートを外部へ送信しますか？`,
                  )
                )
                  return;
                setDiagnosticsMessage("");
                try {
                  setDiagnosticsState(
                    await window.mangai.diagnostics.uploadPending(),
                  );
                  setDiagnosticsMessage("未送信レポートを送信しました。");
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
              未送信分を送信
            </button>
          </div>
          {diagnosticsMessage && <p className="notice">{diagnosticsMessage}</p>}
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
                    <p>{item.message}</p>
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
              <h2>AI設定の変更履歴</h2>
              <p>
                接続URLやモデル名の実値は記録せず、変更項目と状態だけを端末内へ保存します。
              </p>
            </div>
            <span className="hub-readonly-badge">監査履歴</span>
          </div>
          {!settingsHistory.length ? (
            <p className="diagnostic-empty">設定変更はまだありません。</p>
          ) : (
            <div className="job-list">
              {settingsHistory.slice(0, 10).map((item) => (
                <article key={item.id}>
                  <div>
                    <b>{providerName(item.providerId, t)}</b>
                    <p>
                      {item.summary.enabled ? "有効" : "無効"}・
                      {item.summary.endpointKind === "local"
                        ? "ローカル接続"
                        : "リモート接続"}
                      ・変更: {item.changedFields.join("、")}
                    </p>
                    <small>
                      {new Date(item.createdAt).toLocaleString("ja-JP")}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        {settings.map((value) => (
          <section className="panel-lite" key={value.providerId}>
            <div className="setting-title">
              <h2>
                {value.providerId === "ollama"
                  ? "Ollama"
                  : value.providerId === "comfyui"
                    ? "ComfyUI"
                    : "モックプロバイダー"}
              </h2>
              <label className="check">
                <input
                  type="checkbox"
                  checked={value.enabled}
                  onChange={(e) =>
                    update(value.providerId, { enabled: e.target.checked })
                  }
                />
                有効
              </label>
            </div>
            <label>
              接続URL
              <input
                value={value.baseUrl}
                onChange={(e) =>
                  update(value.providerId, { baseUrl: e.target.value })
                }
              />
            </label>
            <label>
              許可するリモートorigin（1行に1件）
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
              <small>
                localhostは登録不要です。それ以外はHTTPS
                originの完全一致だけを許可します。
              </small>
            </label>
            {value.providerId !== "comfyui" && (
              <>
                <label>
                  使用モデル
                  <select
                    value={value.modelId}
                    onChange={(e) =>
                      update(value.providerId, { modelId: e.target.value })
                    }
                  >
                    <option value="">選択してください</option>
                    {models[value.providerId]?.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </label>
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
                    最大出力
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
                  ストリーミング
                </label>
              </>
            )}
            <div className="grid">
              <label>
                タイムアウト(ms)
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
                  ポーリング間隔(ms)
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
              <button onClick={() => save(value)}>保存</button>
              <button className="secondary" onClick={() => check(value)}>
                接続確認
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
                      [value.providerId]: `${list.length}件のモデルを取得しました。${list.some((model) => model.cached) ? "（前回取得したキャッシュ）" : ""}`,
                    }));
                  }}
                >
                  モデル一覧更新
                </button>
              )}
            </div>
            {status[value.providerId] && (
              <p className="notice">{status[value.providerId]}</p>
            )}
          </section>
        ))}
        <section className="panel-lite">
          <h2>プロンプトテンプレート</h2>
          <p>
            初期テンプレートを複製するか、Creator
            Chat用テンプレートを追加・編集できます。
          </p>
          <div className="grid">
            <label>
              名前
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </label>
            <label>
              テンプレート
              <textarea
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
              />
            </label>
            <label>
              システムプロンプト（任意）
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
              {editingTemplateId ? "変更を保存" : "追加"}
            </button>
            {editingTemplateId && (
              <button className="secondary" onClick={resetTemplateForm}>
                編集をキャンセル
              </button>
            )}
          </div>
          <div className="job-list">
            {templates.map((template) => (
              <article key={template.id}>
                <div>
                  <b>
                    {template.name} {template.isBuiltin ? "（初期）" : ""}
                  </b>
                  <p>{template.template}</p>
                  {template.systemPrompt && (
                    <p>システム: {template.systemPrompt}</p>
                  )}
                </div>
                <div className="inline">
                  <button
                    className="secondary"
                    onClick={() => fillTemplateForm(template, true)}
                  >
                    複製
                  </button>
                  {!template.isBuiltin && (
                    <>
                      <button
                        className="secondary"
                        onClick={() => fillTemplateForm(template, false)}
                      >
                        編集
                      </button>
                      <button
                        className="danger"
                        onClick={async () => {
                          setTemplates(
                            await window.mangai.ai.deleteTemplate(template.id),
                          );
                          if (editingTemplateId === template.id)
                            resetTemplateForm();
                        }}
                      >
                        削除
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
