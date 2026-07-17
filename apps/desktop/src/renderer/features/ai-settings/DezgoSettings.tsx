import React from "react";
import type { DesktopApi } from "../../../preload/api";
import { useI18n } from "../../i18n";

type DezgoRuntime = Awaited<
  ReturnType<DesktopApi["ai"]["runtimeInfo"]>
>["dezgo"];
type CredentialState = Awaited<
  ReturnType<DesktopApi["ai"]["credentialState"]>
>;
type DezgoModel = Awaited<
  ReturnType<DesktopApi["ai"]["listModels"]>
>[number];

export function DezgoSettings() {
  const { locale, t, localizeMessage } = useI18n();
  const [runtime, setRuntime] = React.useState<DezgoRuntime | null>(null);
  const [credential, setCredential] =
    React.useState<CredentialState | null>(null);
  const [apiKey, setApiKey] = React.useState("");
  const [models, setModels] = React.useState<DezgoModel[]>([]);
  const [selectedModelId, setSelectedModelId] = React.useState("");
  const [balance, setBalance] = React.useState<number | null>();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    void Promise.all([
      window.mangai.ai.runtimeInfo(),
      window.mangai.ai.credentialState("dezgo"),
    ])
      .then(([runtimeInfo, credentialState]) => {
        setRuntime(runtimeInfo.dezgo);
        setCredential(credentialState);
      })
      .catch((cause) => {
        setMessage(cause instanceof Error ? cause.message : String(cause));
      });
  }, []);

  React.useEffect(() => {
    if (models.length && !models.some((model) => model.id === selectedModelId))
      setSelectedModelId(models[0].id);
  }, [models, selectedModelId]);

  const byokEnabled = Boolean(
    runtime?.dezgoProviderEnabled && runtime.dezgoDirectByokEnabled,
  );
  const available = byokEnabled && credential?.available;
  const selectedModel = models.find((model) => model.id === selectedModelId);
  const badge = !runtime
    ? t("settings.dezgo.loading")
    : !runtime.dezgoProviderEnabled
      ? t("settings.dezgo.providerDisabled")
      : !runtime.dezgoDirectByokEnabled
        ? t("settings.dezgo.byokDisabled")
        : !credential?.available
          ? t("settings.dezgo.storeUnavailable")
          : credential.configured
            ? t("settings.dezgo.keyConfigured")
            : t("settings.dezgo.keyMissing");

  const saveCredential = async () => {
    setBusy(true);
    setMessage(t("settings.dezgo.saving"));
    try {
      const saved = await window.mangai.ai.saveCredential(
        "dezgo",
        apiKey.trim(),
      );
      setCredential((current) => ({
        providerId: "dezgo",
        configured: saved.configured,
        available: current?.available ?? true,
      }));
      setApiKey("");
      setMessage(t("settings.dezgo.saved"));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const deleteCredential = async () => {
    if (!confirm(t("settings.dezgo.deleteConfirm"))) return;
    setBusy(true);
    setMessage("");
    try {
      const deleted = await window.mangai.ai.deleteCredential("dezgo");
      setCredential((current) => ({
        providerId: "dezgo",
        configured: deleted.configured,
        available: current?.available ?? true,
      }));
      setModels([]);
      setSelectedModelId("");
      setBalance(undefined);
      setMessage(t("settings.dezgo.deleted"));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const checkConnection = async () => {
    setBusy(true);
    setMessage(t("settings.dezgo.checking"));
    const startedAt = performance.now();
    try {
      const [modelList, balanceResult] = await Promise.all([
        window.mangai.ai.listModels("dezgo", true),
        window.mangai.ai.providerBalance("dezgo"),
      ]);
      setModels(modelList);
      setBalance(balanceResult.balanceUsd);
      setMessage(
        t("settings.dezgo.connected", {
          count: modelList.length,
          latency: Math.round(performance.now() - startedAt),
        }),
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="panel-lite dezgo-settings"
      aria-labelledby="dezgo-settings-title"
      aria-busy={busy}
    >
      <div className="setting-title">
        <div>
          <h2 id="dezgo-settings-title">Dezgo API</h2>
          <p>{t("settings.dezgo.description")}</p>
        </div>
        <span className="hub-readonly-badge">{badge}</span>
      </div>

      <p className="diagnostic-empty">{t("settings.dezgo.securityHelp")}</p>
      {!byokEnabled && runtime && (
        <p className="diagnostic-empty">{t("settings.dezgo.previewHelp")}</p>
      )}

      <label>
        {t("settings.dezgo.apiKey")}
        <input
          type="password"
          value={apiKey}
          disabled={!available || busy}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="dezgo-key-help"
          placeholder={t("settings.dezgo.apiKeyPlaceholder")}
          onChange={(event) => setApiKey(event.target.value)}
        />
        <small id="dezgo-key-help">{t("settings.dezgo.apiKeyHelp")}</small>
      </label>

      <div className="inline">
        <button
          disabled={!available || busy || !apiKey.trim()}
          onClick={() => void saveCredential()}
        >
          {credential?.configured
            ? t("settings.dezgo.replaceKey")
            : t("settings.dezgo.saveKey")}
        </button>
        <button
          className="secondary"
          disabled={!available || busy || !credential?.configured}
          onClick={() => void checkConnection()}
        >
          {t("settings.dezgo.check")}
        </button>
        <button
          className="secondary"
          disabled={!available || busy || !credential?.configured}
          onClick={() => void deleteCredential()}
        >
          {t("settings.dezgo.deleteKey")}
        </button>
      </div>

      <dl className="dezgo-summary">
        <div>
          <dt>{t("settings.dezgo.balance")}</dt>
          <dd>
            {balance === undefined
              ? t("settings.dezgo.notChecked")
              : balance === null
                ? t("settings.dezgo.balanceUnknown")
                : new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(balance)}
          </dd>
        </div>
        <div>
          <dt>{t("settings.dezgo.models")}</dt>
          <dd>{t("settings.dezgo.modelCount", { count: models.length })}</dd>
        </div>
        <div>
          <dt>{t("settings.dezgo.dispatcher")}</dt>
          <dd>
            {!runtime
              ? t("settings.dezgo.loading")
              : runtime.dezgoDispatchEnabled
                ? t("settings.dezgo.dispatcherEnabled")
                : t("settings.dezgo.dispatcherDisabled")}
          </dd>
        </div>
      </dl>

      {models.length > 0 && (
        <label>
          {t("settings.dezgo.modelDetails")}
          <select
            value={selectedModelId}
            onChange={(event) => setSelectedModelId(event.target.value)}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {selectedModel && (
        <div className="dezgo-model-details">
          <b>{selectedModel.name}</b>
          {selectedModel.description && <p>{selectedModel.description}</p>}
          <small>
            {[
              selectedModel.family,
              selectedModel.nativeResolution
                ? `${selectedModel.nativeResolution.width} × ${selectedModel.nativeResolution.height}`
                : null,
              selectedModel.supportedFunctions?.join(", "),
              selectedModel.cached ? t("settings.dezgo.cached") : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </small>
        </div>
      )}

      <p className="external-preview-warning">
        {runtime?.dezgoDispatchEnabled
          ? t("settings.dezgo.generationEnabled")
          : t("settings.dezgo.generationDisabled")}
      </p>
      {message && (
        <p className="notice" role="status" aria-live="polite">
          {localizeMessage(message)}
        </p>
      )}
    </section>
  );
}
