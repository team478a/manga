import React from "react";
import type {
  HubDeviceState,
  HubStatus as HubStatusResult,
} from "../../../preload/api";
import { useI18n } from "../../i18n";

const STORAGE_KEY = "mangai.hub-base-url";
const DEFAULT_HUB_URL = "http://localhost:3000";

function initialBaseUrl() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_HUB_URL;
  } catch {
    return DEFAULT_HUB_URL;
  }
}

export function HubStatus({
  projectId,
  projectTitle,
  projectDescription,
  onClose,
}: {
  projectId: string;
  projectTitle: string;
  projectDescription: string;
  onClose: () => void;
}) {
  const { t, formatDateTime } = useI18n();
  const [baseUrl, setBaseUrl] = React.useState(initialBaseUrl);
  const [status, setStatus] = React.useState<HubStatusResult | null>(null);
  const [device, setDevice] = React.useState<HubDeviceState | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const check = React.useCallback(async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await window.mangai.hubStatus(projectId, baseUrl);
      setStatus(result);
      try {
        localStorage.setItem(STORAGE_KEY, baseUrl.trim());
      } catch {
        // Continue the query even when local settings cannot be persisted.
      }
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [baseUrl, projectId]);

  React.useEffect(() => {
    void window.mangai
      .hubDeviceState()
      .then(setDevice)
      .then(() => check());
  }, []);

  React.useEffect(() => {
    if (device?.status !== "pending") return;
    const timer = window.setInterval(async () => {
      try {
        const next = await window.mangai.pollHubDeviceAuthorization();
        setDevice(next);
        if (next.status === "approved") await check();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [device?.status, check]);

  const publicUrl =
    status?.linked === true && status.work.isPublic
      ? `${baseUrl.trim().replace(/\/+$/, "")}${status.work.path}`
      : "";
  const verificationUrl = device
    ? `${device.baseUrl.replace(/\/+$/, "")}${device.verificationPath}`
    : "";
  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setError("");
      setMessage(successMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <main className="tool-page">
      <header className="tool-header">
        <button onClick={onClose}>{t("hub.backWorkspace")}</button>
        <h1>{t("hub.title")}</h1>
        <span>{t("hub.subtitle")}</span>
      </header>
      <div className="tool-content hub-content">
        <section className="panel-lite">
          <div className="setting-title">
            <div>
              <h2>{t("hub.statusTitle")}</h2>
              <p>{projectTitle}</p>
            </div>
            <span className="hub-readonly-badge">
              {device?.status === "approved"
                ? t("hub.deviceApproved")
                : t("hub.publicOnly")}
            </span>
          </div>
          <label>
            {t("hub.url")}
            <div className="inline hub-url-row">
              <input
                data-a11y-field="hub-url"
                type="url"
                spellCheck={false}
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://hub.example.com"
              />
              <button
                data-a11y-action="check-hub"
                disabled={busy || !baseUrl.trim()}
                onClick={check}
              >
                {busy ? t("hub.checking") : t("hub.recheck")}
              </button>
            </div>
          </label>
          <small className="hub-help">
            {t("hub.urlHelp")}
          </small>
        </section>

        <section className="panel-lite hub-device-card">
          <div className="setting-title">
            <div>
              <h2>{t("hub.deviceTitle")}</h2>
              <p>{t("hub.deviceDescription")}</p>
            </div>
            {device?.status === "approved" ? (
              <button
                className="secondary"
                onClick={async () => {
                  await window.mangai.disconnectHubDevice();
                  setDevice(null);
                  await check();
                }}
              >
                {t("hub.disconnect")}
              </button>
            ) : (
              <button
                disabled={busy || !baseUrl.trim()}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    setDevice(
                      await window.mangai.startHubDeviceAuthorization(baseUrl),
                    );
                  } catch (cause) {
                    setError(
                      cause instanceof Error ? cause.message : String(cause),
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("hub.startAuthorization")}
              </button>
            )}
          </div>
          {device?.status === "pending" && (
            <div className="hub-pairing">
              <p>{t("hub.approvalPrompt")}</p>
              <strong>{device.userCode}</strong>
              <code>{verificationUrl}</code>
              <button
                className="secondary"
                onClick={() =>
                  void copyToClipboard(
                    verificationUrl,
                    t("hub.approvalUrlCopied"),
                  )
                }
              >
                {t("hub.copyApprovalUrl")}
              </button>
              <small>{t("hub.waitingApproval")}</small>
            </div>
          )}
          {device?.status === "approved" && (
            <div className="notice">
              {device.scopes?.includes("works:write:draft")
                ? t("hub.draftWriteApproved")
                : t("hub.readOnlyApproved")}
              {" · "}
              {t("hub.expires", {
                value: device.tokenExpiresAt
                  ? formatDateTime(device.tokenExpiresAt)
                  : t("hub.checking"),
              })}
            </div>
          )}
          {device &&
            ["denied", "expired", "revoked"].includes(device.status) && (
              <div className="error" role="alert">
                {t("hub.authorizationInvalid")}
              </div>
            )}
        </section>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="notice" role="status" aria-live="polite">
            {message}
          </div>
        )}

        {!error && busy && !status && (
          <section
            className="panel-lite hub-state-card"
            aria-live="polite"
          >
            <p>{t("hub.checkingStatus")}</p>
          </section>
        )}

        {!error && status?.linked === false && (
          <section className="panel-lite hub-state-card unpublished">
            <b>{t("hub.notLinked")}</b>
            <p>{status.message}</p>
            <small>
              {t("hub.notLinkedHelp")}
            </small>
          </section>
        )}

        {status?.linked === true && (
          <section className="panel-lite hub-state-card published">
            <div className="hub-status-heading">
              <span>
                {status.work.isPublic
                  ? t("hub.statusPublic")
                  : status.work.status === "draft"
                    ? t("hub.statusDraft")
                    : t("hub.statusPrivate")}
              </span>
              <small>
                {t("hub.lastUpdated", {
                  value: formatDateTime(status.work.updatedAt),
                })}
              </small>
            </div>
            <h2>{status.work.title}</h2>
            {status.work.description && <p>{status.work.description}</p>}
            <dl className="hub-status-grid">
              <div>
                <dt>{t("hub.workStatus")}</dt>
                <dd>
                  {status.work.isPublic ? t("hub.public") : t("hub.private")}
                </dd>
              </div>
              <div>
                <dt>{t("hub.activeProducts")}</dt>
                <dd>
                  {t("hub.items", {
                    count: status.sales.activeProductCount,
                  })}
                </dd>
              </div>
              <div>
                <dt>{t("hub.pausedProducts")}</dt>
                <dd>
                  {t("hub.items", {
                    count: status.sales.pausedProductCount,
                  })}
                </dd>
              </div>
              <div>
                <dt>{t("hub.salesStatus")}</dt>
                <dd>
                  {status.sales.available
                    ? t("hub.available")
                    : t("hub.preparing")}
                </dd>
              </div>
            </dl>
            {publicUrl && (
              <div className="hub-public-url">
                <code>{publicUrl}</code>
                <button
                  className="secondary"
                  onClick={() =>
                    void copyToClipboard(publicUrl, t("hub.publicUrlCopied"))
                  }
                >
                  {t("hub.copyUrl")}
                </button>
              </div>
            )}
            {!status.work.isPublic && status.work.status === "draft" && (
              <div className="hub-public-url">
                <div>
                  <b>{t("hub.desktopDiff")}</b>
                  <small>
                    {t("hub.titleDiff", {
                      value:
                        status.work.title === projectTitle
                          ? t("hub.same")
                          : t("hub.changed"),
                    })}
                    {" · "}
                    {t("hub.descriptionDiff", {
                      value:
                        status.work.description === projectDescription
                          ? t("hub.same")
                          : t("hub.changed"),
                    })}
                  </small>
                </div>
                <button
                  disabled={
                    busy ||
                    !status.work.canWriteDraft ||
                    (status.work.title === projectTitle &&
                      status.work.description === projectDescription)
                  }
                  onClick={async () => {
                    if (
                      !window.confirm(
                        t("hub.updateConfirm"),
                      )
                    )
                      return;
                    setBusy(true);
                    setError("");
                    setMessage("");
                    try {
                      await window.mangai.updateHubDraft({
                        projectId,
                        baseUrl,
                        title: projectTitle,
                        description: projectDescription,
                        expectedUpdatedAt: status.work.updatedAt,
                      });
                      await check();
                      setMessage(t("hub.updated"));
                    } catch (cause) {
                      setError(
                        cause instanceof Error ? cause.message : String(cause),
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t("hub.updateDraft")}
                </button>
                {!status.work.canWriteDraft && (
                  <small>{t("hub.reauthorize")}</small>
                )}
              </div>
            )}
          </section>
        )}

        <section className="panel-lite hub-security-note">
          <h2>{t("hub.securityTitle")}</h2>
          <p>{t("hub.securityDescription")}</p>
          <small>Project ID: {projectId}</small>
        </section>
      </div>
    </main>
  );
}
