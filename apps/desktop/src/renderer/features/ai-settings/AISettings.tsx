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

const providerName = (id: ProviderSettings["providerId"]) =>
  id === "ollama" ? "Ollama" : id === "comfyui" ? "ComfyUI" : "モック";

const diagnosticLabel: Record<DiagnosticLevel, string> = {
  running: "確認中",
  success: "成功",
  warning: "要確認",
  error: "失敗",
};
const runtimeProfileLabel: Record<RuntimeProfileSelection, string> = {
  auto: "自動（推奨）",
  cpu_only: "CPUのみ",
  vram_6gb: "VRAM 6GB以下",
  vram_8gb: "VRAM 8GB",
  vram_12gb: "VRAM 12GB",
  vram_16gb: "VRAM 16GB",
  vram_24gb_plus: "VRAM 24GB以上",
  remote_render: "Render Node",
};

async function diagnoseComfyWorkflows(report: (item: DiagnosticItem) => void) {
  report({
    id: "comfyui-workflow",
    label: "ComfyUI ワークフロー",
    level: "running",
    message: "登録内容を確認しています…",
  });
  try {
    const workflows =
      (await window.mangai.ai.listWorkflows()) as ComfyWorkflow[];
    if (!workflows.length) {
      report({
        id: "comfyui-workflow",
        label: "ComfyUI ワークフロー",
        level: "warning",
        message:
          "ワークフローが未登録です。AI生成画面からJSONを追加してください。",
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
      label: "ComfyUI ワークフロー",
      level: invalid.length || !defaultWorkflow ? "warning" : "success",
      message: invalid.length
        ? `${workflows.length}件中${invalid.length}件のマッピングを確認してください: ${invalid.map((item) => item.workflow.name).join("、")}`
        : !defaultWorkflow
          ? `${workflows.length}件は有効ですが、既定ワークフローがありません。`
          : `${workflows.length}件のマッピングが有効です。既定: ${defaultWorkflow.name}`,
    });
    if (defaultWorkflow) {
      const defaultResult = results.find(
        (item) => item.workflow.id === defaultWorkflow.id,
      )?.result;
      report({
        id: "comfyui-low-spec",
        label: "低スペック向けワークフロー",
        level: defaultResult?.optimization.lowSpecVaeReady
          ? "success"
          : "warning",
        message: defaultResult?.optimization.lowSpecVaeReady
          ? "既定ワークフローにVAEDecodeTiledがあります。CPUオフロードはComfyUI起動設定を実環境で確認してください。"
          : "既定ワークフローにVAEDecodeTiledがありません。8GB以下向けにはタイルVAE版を登録してください。",
      });
    }
  } catch (cause) {
    report({
      id: "comfyui-workflow",
      label: "ComfyUI ワークフロー",
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
        label: `${providerName(value.providerId)} 接続`,
        level: "running",
        message: "設定を確認しています…",
      })),
    );
    try {
      for (const value of providers) {
        const name = providerName(value.providerId);
        try {
          await window.mangai.ai.saveSettings(value);
        } catch (cause) {
          report({
            id: `${value.providerId}-connection`,
            label: `${name} 設定`,
            level: "error",
            message: `設定を保存できません。${cause instanceof Error ? cause.message : String(cause)}`,
          });
          continue;
        }
        if (!value.enabled) {
          report({
            id: `${value.providerId}-connection`,
            label: `${name} 接続`,
            level: "warning",
            message: `${name}は無効です。使用するときは「有効」をオンにしてください。`,
          });
          continue;
        }
        let connected = false;
        try {
          const result = await window.mangai.ai.checkProvider(value.providerId);
          connected = result.ok;
          report({
            id: `${value.providerId}-connection`,
            label: `${name} 接続`,
            level: result.ok ? "success" : "error",
            message: `${result.message}${result.latencyMs !== undefined ? ` 応答 ${result.latencyMs}ms` : ""}`,
          });
        } catch (cause) {
          report({
            id: `${value.providerId}-connection`,
            label: `${name} 接続`,
            level: "error",
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
        if (value.providerId === "comfyui")
          await diagnoseComfyWorkflows(report);
        if (value.providerId !== "ollama" || !connected) continue;
        report({
          id: "ollama-model",
          label: "Ollama モデル",
          level: "running",
          message: "モデル一覧を確認しています…",
        });
        try {
          const list = await window.mangai.ai.listModels("ollama");
          setModels((current) => ({ ...current, ollama: list }));
          const selected = list.find((model) => model.id === value.modelId);
          const cached = list.some((model) => model.cached);
          report({
            id: "ollama-model",
            label: "Ollama モデル",
            level:
              !list.length || (value.modelId && !selected)
                ? "error"
                : !value.modelId || cached
                  ? "warning"
                  : "success",
            message: !list.length
              ? "利用可能なモデルがありません。Ollamaでモデルを取得してください。"
              : !value.modelId
                ? `${list.length}件見つかりました。使用モデルを選択してください。`
                : !selected
                  ? `選択中のモデル「${value.modelId}」が見つかりません。`
                  : cached
                    ? `「${selected.name}」を前回取得したキャッシュで確認しました。`
                    : `「${selected.name}」を利用できます。`,
          });
        } catch (cause) {
          report({
            id: "ollama-model",
            label: "Ollama モデル",
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
                ? runtimeProfileLabel[runtimeProfile.effectiveProfile]
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
                  {Object.entries(runtimeProfileLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <small>
                  推奨: {runtimeProfileLabel[runtimeProfile.recommendedProfile]}
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
        <section className="panel-lite ai-diagnostics">
          <div className="setting-title">
            <div>
              <h2>AI接続診断</h2>
              <p>
                現在の設定、ローカルAIへの接続、モデルとワークフローの準備状態をまとめて確認します。
              </p>
            </div>
            <button disabled={diagnosing} onClick={() => void runDiagnostics()}>
              {diagnosing ? "診断中…" : "一括診断を実行"}
            </button>
          </div>
          {!diagnostics.length ? (
            <p className="diagnostic-empty">
              診断では生成処理を実行せず、OllamaとComfyUIのローカル接続だけを確認します。
            </p>
          ) : (
            <div className="diagnostic-list" aria-live="polite">
              {diagnostics.map((item) => (
                <article
                  className={`diagnostic-item ${item.level}`}
                  key={item.id}
                >
                  <span>{diagnosticLabel[item.level]}</span>
                  <div>
                    <b>{item.label}</b>
                    <p>{item.message}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
          {diagnosedAt && !diagnosing && (
            <small>最終診断: {diagnosedAt.toLocaleString("ja-JP")}</small>
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
                    <b>{providerName(item.providerId)}</b>
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
