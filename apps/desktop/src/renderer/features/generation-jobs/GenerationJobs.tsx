import React from "react";
import type { ProjectBundle } from "@mangai/project-core";
import { useI18n } from "../../i18n";

function generationStatusKey(status: string) {
  if (status === "queued") return "generation.status.queued" as const;
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
export function GenerationJobs({
  bundle,
  episodeId,
  pageId,
  onBundle,
  onClose,
}: {
  bundle: ProjectBundle;
  episodeId?: string;
  pageId?: string;
  onBundle: (value: ProjectBundle) => void;
  onClose: () => void;
}) {
  const { t, formatDateTime } = useI18n();
  const [jobs, setJobs] = React.useState<any[]>([]),
    [routes, setRoutes] = React.useState<any[]>([]),
    [workflows, setWorkflows] = React.useState<any[]>([]),
    [workflowId, setWorkflowId] = React.useState(""),
    [promptText, setPrompt] = React.useState(""),
    [negative, setNegative] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [workflowMessage, setWorkflowMessage] = React.useState("");
  const load = () =>
    Promise.all([
      window.mangai.ai.listJobs(bundle.project.id).then(setJobs),
      window.mangai.ai.listRouteDecisions(bundle.project.id).then(setRoutes),
      window.mangai.ai.listWorkflows().then(setWorkflows),
    ]);
  React.useEffect(() => {
    void load();
  }, []);
  const generate = async () => {
    if (!workflowId || !promptText.trim()) return;
    setBusy(true);
    setError("");
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
      });
      if (result.bundle) onBundle(result.bundle);
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
  return (
    <main className="tool-page">
      <header className="tool-header">
        <button onClick={onClose}>{t("generation.backWorkspace")}</button>
        <h1>{t("generation.title")}</h1>
      </header>
      <div className="tool-content">
        <section className="panel-lite">
          <h2>{t("generation.comfyTitle")}</h2>
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
              {error}
            </p>
          )}
        </section>
        <section className="panel-lite">
          <h2>{t("generation.history")}</h2>
          <div className="job-list">
            {jobs.map((job) => {
              const route = routes.find((item) => item.jobId === job.id);
              return (
                <article key={job.id}>
                  <div>
                    <b>
                      {job.generationType === "image"
                        ? t("generation.image")
                        : t("generation.text")}{" "}
                      / {job.providerId}
                    </b>
                    <p>{job.prompt}</p>
                    <small>
                      {t(generationStatusKey(job.status))}・
                      {formatDateTime(job.createdAt)}
                    </small>
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
                        {job.errorMessage}
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
                  </div>
                  <div className="inline">
                    {job.status === "completed" &&
                      job.generationType === "image" && (
                        <button className="secondary" onClick={onClose}>
                          {t("generation.openAsset")}
                        </button>
                      )}
                    {job.status === "running" && (
                      <button
                        className="danger"
                        onClick={() =>
                          window.mangai.ai.cancel(job.id).then(load)
                        }
                      >
                        {t("generation.cancel")}
                      </button>
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
    </main>
  );
}
