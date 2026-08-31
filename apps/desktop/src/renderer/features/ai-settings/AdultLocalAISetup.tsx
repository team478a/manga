import React from "react";
import {
  ADULT_PILOT_MODEL_BYTES,
  evaluateAdultLocalAISetupReadiness,
  type RuntimeProfileState,
} from "@mangai/ai-core";
import { useI18n } from "../../i18n";
import type { AdultPilotDownloadProgress } from "../../../preload/api";

export function AdultLocalAISetup({
  runtimeProfile,
}: {
  runtimeProfile: RuntimeProfileState | null;
}) {
  const { t } = useI18n();
  const [consent, setConsent] = React.useState({
    licenseTerms: false,
    localOnly: false,
    adultSafety: false,
  });
  const [root, setRoot] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<AdultPilotDownloadProgress | null>(null);
  const [running, setRunning] = React.useState<"download" | "install" | null>(null);
  const [downloadVerified, setDownloadVerified] = React.useState(false);
  const [message, setMessage] = React.useState("");
  React.useEffect(
    () => window.mangai.ai.onAdultPilotProgress(setProgress),
    [],
  );
  const readiness = evaluateAdultLocalAISetupReadiness(runtimeProfile, consent);
  const update = (key: keyof typeof consent, value: boolean) =>
    setConsent((current) => ({ ...current, [key]: value }));
  const reasonKey = {
    ready: "settings.adultSetup.reasonReady",
    gpu_missing: "settings.adultSetup.reasonGpuMissing",
    vram_below_pilot: "settings.adultSetup.reasonVram",
    consent_required: "settings.adultSetup.reasonConsent",
  } as const;

  return (
    <section className="panel-lite adult-local-ai-setup" aria-labelledby="adult-local-ai-setup-title">
      <div className="setting-title">
        <div>
          <h2 id="adult-local-ai-setup-title">{t("settings.adultSetup.title")}</h2>
          <p>{t("settings.adultSetup.description")}</p>
        </div>
        <span className="hub-readonly-badge">
          {readiness.deviceEligible
            ? t("settings.adultSetup.deviceEligible")
            : t("settings.adultSetup.deviceBlocked")}
        </span>
      </div>
      <ol className="adult-setup-steps">
        <li className={readiness.deviceEligible ? "complete" : "blocked"}>
          <b>{t("settings.adultSetup.stepDevice")}</b>
          <p>{t(reasonKey[readiness.reason === "consent_required" ? "ready" : readiness.reason], {
            value: readiness.detectedVramMb === null
              ? t("settings.runtime.unknown")
              : `${(readiness.detectedVramMb / 1024).toFixed(1)}GB`,
          })}</p>
        </li>
        <li className={readiness.consentComplete ? "complete" : "pending"}>
          <b>{t("settings.adultSetup.stepTerms")}</b>
          <div className="adult-setup-consents">
            <label className="check">
              <input type="checkbox" checked={consent.licenseTerms} onChange={(event) => update("licenseTerms", event.target.checked)} />
              {t("settings.adultSetup.consentLicense")}
            </label>
            <label className="check">
              <input type="checkbox" checked={consent.localOnly} onChange={(event) => update("localOnly", event.target.checked)} />
              {t("settings.adultSetup.consentLocal")}
            </label>
            <label className="check">
              <input type="checkbox" checked={consent.adultSafety} onChange={(event) => update("adultSafety", event.target.checked)} />
              {t("settings.adultSetup.consentSafety")}
            </label>
          </div>
        </li>
        <li className={readiness.acquisitionReady ? "pending" : "locked"}>
          <b>{t("settings.adultSetup.stepDownload")}</b>
          <p>{t("settings.adultSetup.downloadPlan", {
            value: (ADULT_PILOT_MODEL_BYTES / 1024 ** 3).toFixed(1),
          })}</p>
        </li>
        <li className="locked">
          <b>{t("settings.adultSetup.stepVerify")}</b>
          <p>{t("settings.adultSetup.verifyPlan")}</p>
        </li>
      </ol>
      <div className="inline">
        <button
          className="secondary"
          disabled={!readiness.acquisitionReady || Boolean(running)}
          onClick={async () => {
            const selected = await window.mangai.ai.chooseAdultPilotDirectory();
            if (selected) setRoot(selected);
          }}
        >
          {t("settings.adultSetup.chooseDirectory")}
        </button>
        <button
          disabled={!readiness.acquisitionReady || !root || Boolean(running)}
          onClick={async () => {
            if (!root) return;
            setRunning("download");
            setMessage("");
            try {
              const result = await window.mangai.ai.downloadAdultPilot(root, {
                licenseTerms: true,
                localOnly: true,
                adultSafety: true,
              });
              setMessage(
                result.status === "verified"
                  ? t("settings.adultSetup.downloadVerified")
                  : t("settings.adultSetup.downloadCanceled"),
              );
              setDownloadVerified(result.status === "verified");
            } catch (cause) {
              setMessage(cause instanceof Error ? cause.message : String(cause));
            } finally {
              setRunning(null);
            }
          }}
        >
          {running === "download"
            ? t("settings.adultSetup.downloading")
            : t("settings.adultSetup.startDownload")}
        </button>
        <button
          className="secondary"
          disabled={!readiness.acquisitionReady || !root || !downloadVerified || Boolean(running)}
          onClick={async () => {
            if (!root) return;
            setRunning("install");
            setMessage("");
            try {
              await window.mangai.ai.installAdultPilotRuntime(root, {
                licenseTerms: true,
                localOnly: true,
                adultSafety: true,
              });
              setMessage(t("settings.adultSetup.runtimeInstalled"));
            } catch (cause) {
              setMessage(cause instanceof Error ? cause.message : String(cause));
            } finally {
              setRunning(null);
            }
          }}
        >
          {t("settings.adultSetup.installRuntime")}
        </button>
        {running === "download" && (
          <button
            className="danger"
            onClick={() => void window.mangai.ai.cancelAdultPilotDownload()}
          >
            {t("settings.adultSetup.cancelDownload")}
          </button>
        )}
        <span role="status" aria-live="polite">
          {message || t(reasonKey[readiness.reason], {
              value: readiness.detectedVramMb === null
                ? t("settings.runtime.unknown")
                : `${(readiness.detectedVramMb / 1024).toFixed(1)}GB`,
            })}
        </span>
      </div>
      {root && <p className="adult-setup-path">{t("settings.adultSetup.destination", { value: root })}</p>}
      {progress && (
        <div className="adult-setup-progress" aria-live="polite">
          <progress value={progress.downloadedBytes} max={progress.totalBytes} />
          <span>
            {t("settings.adultSetup.progress", {
              current: progress.artifactIndex,
              total: progress.artifactCount,
              percent: Math.min(100, Math.round((progress.downloadedBytes / progress.totalBytes) * 100)),
            })}
          </span>
        </div>
      )}
      <small>{t("settings.adultSetup.noCloud")}</small>
    </section>
  );
}
