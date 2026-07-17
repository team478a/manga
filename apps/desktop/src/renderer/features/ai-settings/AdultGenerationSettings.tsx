import React from "react";
import {
  ADULT_GENERATION_TERMS_VERSION,
  type AdultGenerationSettings as AdultGenerationSettingsState,
} from "@mangai/ai-core";
import { useI18n } from "../../i18n";

export function AdultGenerationSettings() {
  const { t, formatDateTime } = useI18n();
  const [settings, setSettings] =
    React.useState<AdultGenerationSettingsState | null>(null);
  const [providerPolicy, setProviderPolicy] = React.useState<Awaited<
    ReturnType<typeof window.mangai.ai.getAdultProviderPolicyState>
  > | null>(null);
  const [ageConfirmed, setAgeConfirmed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    void Promise.all([
      window.mangai.ai.getAdultGenerationSettings(),
      window.mangai.ai.getAdultProviderPolicyState(),
    ])
      .then(([nextSettings, nextProviderPolicy]) => {
        setSettings(nextSettings);
        setProviderPolicy(nextProviderPolicy);
      })
      .catch((cause) =>
        setMessage(cause instanceof Error ? cause.message : String(cause)),
      );
  }, []);

  const run = async (
    operation: () => Promise<AdultGenerationSettingsState>,
    successMessage: string,
  ) => {
    setBusy(true);
    setMessage("");
    try {
      setSettings(await operation());
      setMessage(successMessage);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="panel-lite adult-generation-settings"
      aria-labelledby="adult-generation-settings-title"
      aria-busy={busy}
    >
      <div className="setting-title">
        <div>
          <h2 id="adult-generation-settings-title">
            {t("settings.adult.title")}
          </h2>
          <p>{t("settings.adult.description")}</p>
        </div>
        <span className="hub-readonly-badge">
          {settings
            ? t(`settings.adult.status.${settings.consentStatus}`)
            : t("settings.adult.loading")}
        </span>
      </div>

      <p className="diagnostic-empty">{t("settings.adult.externalDisabled")}</p>

      <label className="check">
        <input
          type="checkbox"
          checked={settings?.administratorEnabled ?? false}
          disabled={!settings || busy}
          onChange={(event) =>
            void run(
              () =>
                window.mangai.ai.setAdultGenerationAdministratorEnabled(
                  event.target.checked,
                ),
              event.target.checked
                ? t("settings.adult.administratorEnabled")
                : t("settings.adult.administratorDisabled"),
            )
          }
        />
        {t("settings.adult.administratorToggle")}
      </label>
      <small>{t("settings.adult.administratorHelp")}</small>

      <div className="panel-lite">
        <label className="check">
          <input
            type="checkbox"
            checked={ageConfirmed}
            disabled={busy}
            onChange={(event) => setAgeConfirmed(event.target.checked)}
          />
          {t("settings.adult.ageConfirmation")}
        </label>
        <small>{t("settings.adult.privacyHelp")}</small>
        <div className="inline">
          <button
            disabled={busy || !ageConfirmed}
            onClick={() =>
              void run(
                () =>
                  window.mangai.ai.confirmAdultGeneration18Plus({
                    userConfirmed18Plus: true,
                    termsVersion: ADULT_GENERATION_TERMS_VERSION,
                  }),
                t("settings.adult.confirmed"),
              ).then(() => setAgeConfirmed(false))
            }
          >
            {t("settings.adult.confirmButton")}
          </button>
          <button
            className="secondary"
            disabled={busy || settings?.consentStatus !== "active"}
            onClick={() => {
              if (!confirm(t("settings.adult.revokeConfirm"))) return;
              void run(
                () => window.mangai.ai.revokeAdultGenerationConsent(),
                t("settings.adult.revoked"),
              );
            }}
          >
            {t("settings.adult.revokeButton")}
          </button>
        </div>
      </div>

      {settings?.confirmedAt && (
        <dl className="dezgo-summary">
          <div>
            <dt>{t("settings.adult.confirmedAt")}</dt>
            <dd>{formatDateTime(settings.confirmedAt)}</dd>
          </div>
          <div>
            <dt>{t("settings.adult.expiresAt")}</dt>
            <dd>
              {settings.expiresAt
                ? formatDateTime(settings.expiresAt)
                : t("settings.adult.notAvailable")}
            </dd>
          </div>
        </dl>
      )}
      <div className="panel-lite">
        <h3>{t("settings.adult.providerPolicyTitle")}</h3>
        <p>
          {t(
            providerPolicy?.importAvailable
              ? "settings.adult.providerPolicyImportReady"
              : "settings.adult.providerPolicyReadonly",
          )}
        </p>
        <dl className="dezgo-summary">
          <div>
            <dt>{t("settings.adult.providerApproval")}</dt>
            <dd>
              {providerPolicy
                ? t(
                    `settings.adult.providerStatus.${providerPolicy.approval.status}`,
                  )
                : t("settings.adult.loading")}
            </dd>
          </div>
          <div>
            <dt>{t("settings.adult.approvedModels")}</dt>
            <dd>
              {providerPolicy
                ? String(providerPolicy.eligibleModelIds.length)
                : "—"}
            </dd>
          </div>
        </dl>
        {providerPolicy?.approval.evidenceSha256 && (
          <small>
            {t("settings.adult.evidenceHash")}: {providerPolicy.approval.evidenceSha256}
          </small>
        )}
        <button
          className="secondary"
          disabled={busy || !providerPolicy?.importAvailable}
          onClick={() => {
            setBusy(true);
            setMessage("");
            void window.mangai.ai
              .importAdultProviderPolicy()
              .then((next) => {
                if (!next) return;
                setProviderPolicy(next);
                setMessage(t("settings.adult.providerPolicyImported"));
              })
              .catch((cause) =>
                setMessage(
                  cause instanceof Error ? cause.message : String(cause),
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          {t("settings.adult.providerPolicyImport")}
        </button>
        {providerPolicy?.lastImport && (
          <small>
            {t("settings.adult.providerPolicyLastImport")}: {formatDateTime(providerPolicy.lastImport.importedAt)}
          </small>
        )}
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
