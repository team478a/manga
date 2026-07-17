import React from "react";
import type { ProjectGenerationPolicy } from "@mangai/ai-core";
import { useI18n } from "../../i18n";

const safeJobTypes = ["background", "prop", "effect"] as const;

export function ProjectGenerationPolicySettings({
  projectId,
  onSaved,
}: {
  projectId: string;
  onSaved: () => void;
}) {
  const { t, localizeMessage } = useI18n();
  const [policy, setPolicy] =
    React.useState<ProjectGenerationPolicy | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    setPolicy(null);
    setMessage("");
    void window.mangai.ai
      .getGenerationPolicy(projectId)
      .then(setPolicy)
      .catch((cause) =>
        setMessage(cause instanceof Error ? cause.message : String(cause)),
      );
  }, [projectId]);

  if (!policy)
    return (
      <section className="panel-lite" aria-busy="true">
        <h2>{t("generation.policy.title")}</h2>
        <p>{t("generation.policy.loading")}</p>
        {message && <p className="notice">{localizeMessage(message)}</p>}
      </section>
    );

  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      const saved = await window.mangai.ai.saveGenerationPolicy({
        projectId,
        externalProcessingPolicy: policy.externalProcessingPolicy,
        preferLocal: policy.preferLocal,
        externalConfirmationRequired: policy.externalConfirmationRequired,
        monthlyCostLimit: policy.monthlyCostLimit,
        customCloudJobTypes: policy.customCloudJobTypes,
      });
      setPolicy(saved);
      setMessage(t("generation.policy.saved"));
      onSaved();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const toggleCustomType = (jobType: (typeof safeJobTypes)[number]) => {
    const selected = policy.customCloudJobTypes.includes(jobType);
    setPolicy({
      ...policy,
      customCloudJobTypes: selected
        ? policy.customCloudJobTypes.filter((value) => value !== jobType)
        : [...policy.customCloudJobTypes, jobType],
    });
  };

  return (
    <section
      className="panel-lite generation-policy"
      aria-labelledby="generation-policy-title"
      aria-busy={busy}
    >
      <div className="setting-title">
        <div>
          <h2 id="generation-policy-title">{t("generation.policy.title")}</h2>
          <p>{t("generation.policy.description")}</p>
        </div>
        <span className="hub-readonly-badge">
          {t(`generation.policy.${policy.externalProcessingPolicy}` as const)}
        </span>
      </div>

      <label>
        {t("generation.policy.mode")}
        <select
          value={policy.externalProcessingPolicy}
          disabled={busy}
          onChange={(event) =>
            setPolicy({
              ...policy,
              externalProcessingPolicy: event.target
                .value as ProjectGenerationPolicy["externalProcessingPolicy"],
            })
          }
        >
          <option value="local_only">
            {t("generation.policy.local_only")}
          </option>
          <option value="safe_assets_only">
            {t("generation.policy.safe_assets_only")}
          </option>
          <option value="background_only">
            {t("generation.policy.background_only")}
          </option>
          <option value="manual_approval">
            {t("generation.policy.manual_approval")}
          </option>
          <option value="custom">{t("generation.policy.custom")}</option>
        </select>
        <small>{t("generation.policy.modeHelp")}</small>
      </label>

      {policy.externalProcessingPolicy === "custom" && (
        <fieldset className="generation-policy-types">
          <legend>{t("generation.policy.customTypes")}</legend>
          {safeJobTypes.map((jobType) => (
            <label className="check" key={jobType}>
              <input
                type="checkbox"
                checked={policy.customCloudJobTypes.includes(jobType)}
                disabled={busy}
                onChange={() => toggleCustomType(jobType)}
              />
              {t(`asset.category.${jobType}` as const)}
            </label>
          ))}
        </fieldset>
      )}

      <div className="grid generation-policy-options">
        <label className="check">
          <input
            type="checkbox"
            checked={policy.preferLocal}
            disabled={busy}
            onChange={(event) =>
              setPolicy({ ...policy, preferLocal: event.target.checked })
            }
          />
          {t("generation.policy.preferLocal")}
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={policy.externalConfirmationRequired}
            disabled={busy}
            onChange={(event) =>
              setPolicy({
                ...policy,
                externalConfirmationRequired: event.target.checked,
              })
            }
          />
          {t("generation.policy.requireConfirmation")}
        </label>
      </div>

      <label>
        {t("generation.policy.monthlyLimit")}
        <input
          type="number"
          min="0"
          step="0.01"
          value={policy.monthlyCostLimit ?? ""}
          disabled={busy}
          placeholder={t("generation.policy.noLimit")}
          onChange={(event) =>
            setPolicy({
              ...policy,
              monthlyCostLimit:
                event.target.value === "" ? null : Number(event.target.value),
            })
          }
        />
        <small>{t("generation.policy.monthlyLimitHelp")}</small>
      </label>

      <div className="inline">
        <button disabled={busy} onClick={() => void save()}>
          {busy
            ? t("generation.policy.saving")
            : t("generation.policy.save")}
        </button>
      </div>
      <p className="external-preview-warning">
        {t("generation.policy.dezgoConfirmation")}
      </p>
      {message && (
        <p className="notice" role="status" aria-live="polite">
          {localizeMessage(message)}
        </p>
      )}
    </section>
  );
}
