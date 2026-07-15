import React from "react";
import type { ProviderSettings } from "@mangai/ai-core";
import { Bot, ChevronUp, RefreshCw, Sparkles } from "lucide-react";
import { StatusBadge, type StatusTone } from "../common/StatusBadge";
import { useI18n } from "../../i18n";

type ProviderId = "ollama" | "comfyui";
type ConnectionState = {
  status: "checking" | "connected" | "disabled" | "error";
  message: string;
  latencyMs?: number;
};
type GenerationJob = {
  id: string;
  providerId: string;
  generationType: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  progress?: number;
  prompt: string;
  errorMessage?: string;
  createdAt: string;
};

const providerLabel: Record<ProviderId, string> = {
  ollama: "Ollama",
  comfyui: "ComfyUI",
};

function connectionTone(state?: ConnectionState): StatusTone {
  if (!state || state.status === "checking") return "info";
  if (state.status === "connected") return "success";
  if (state.status === "disabled") return "neutral";
  return "danger";
}

function jobTone(status: GenerationJob["status"]): StatusTone {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "canceled") return "warning";
  return "info";
}

export function WorkspaceStatusControls({
  projectId,
  onOpenJobs,
  onOpenSettings,
}: {
  projectId: string;
  onOpenJobs: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useI18n();
  const [connections, setConnections] = React.useState<
      Partial<Record<ProviderId, ConnectionState>>
    >({}),
    [jobs, setJobs] = React.useState<GenerationJob[]>([]),
    [drawerOpen, setDrawerOpen] = React.useState(false),
    [refreshing, setRefreshing] = React.useState(false),
    drawerRef = React.useRef<HTMLElement>(null),
    drawerTriggerRef = React.useRef<HTMLButtonElement>(null);

  const refreshConnections = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const settings = await window.mangai.ai.listSettings();
      const providers = (["ollama", "comfyui"] as const).map((id) => ({
        id,
        settings: settings.find(
          (value: ProviderSettings) => value.providerId === id,
        ),
      }));
      setConnections(
        Object.fromEntries(
          providers.map(({ id, settings: value }) => [
            id,
            value?.enabled
              ? {
                  status: "checking",
                  message: t("generation.connectionChecking"),
                }
              : {
                  status: "disabled",
                  message: t("generation.connectionDisabled"),
                },
          ]),
        ),
      );
      await Promise.all(
        providers.map(async ({ id, settings: value }) => {
          if (!value?.enabled) return;
          try {
            const result = await window.mangai.ai.checkProvider(id);
            setConnections((current) => ({
              ...current,
              [id]: {
                status: result.ok ? "connected" : "error",
                message: result.message,
                latencyMs: result.latencyMs,
              },
            }));
          } catch (cause) {
            setConnections((current) => ({
              ...current,
              [id]: {
                status: "error",
                message: cause instanceof Error ? cause.message : String(cause),
              },
            }));
          }
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setConnections({
        ollama: { status: "error", message },
        comfyui: { status: "error", message },
      });
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  const refreshJobs = React.useCallback(
    () =>
      window.mangai.ai
        .listJobs(projectId)
        .then((values) => setJobs(values as GenerationJob[]))
        .catch(() => setJobs([])),
    [projectId],
  );

  React.useEffect(() => {
    void refreshConnections();
    const timer = window.setInterval(() => void refreshConnections(), 60_000);
    return () => window.clearInterval(timer);
  }, [refreshConnections]);

  React.useEffect(() => {
    void refreshJobs();
    const timer = window.setInterval(() => void refreshJobs(), 2_000);
    return () => window.clearInterval(timer);
  }, [refreshJobs]);

  React.useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current
      ?.querySelector<HTMLElement>("button[data-generation-close]")
      ?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      drawerTriggerRef.current?.focus();
    };
  }, [drawerOpen]);

  const activeJobs = jobs.filter(
      (job) => job.status === "queued" || job.status === "running",
    ),
    recentJobs = jobs.slice(0, 8);

  return (
    <>
      <div className="workspace-status-controls">
        {(["ollama", "comfyui"] as const).map((id) => {
          const state = connections[id];
          return (
            <button
              key={id}
              className="status-bar-control"
              title={`${providerLabel[id]}: ${state?.message ?? t("generation.connectionPending")}${state?.latencyMs !== undefined ? ` (${state.latencyMs}ms)` : ""}`}
              onClick={onOpenSettings}
            >
              <Bot size={13} aria-hidden="true" />
              <StatusBadge tone={connectionTone(state)}>
                {providerLabel[id]}
              </StatusBadge>
            </button>
          );
        })}
        <button
          ref={drawerTriggerRef}
          className="status-bar-refresh"
          aria-label={t("generation.refreshConnections")}
          title={t("generation.refreshConnections")}
          disabled={refreshing}
          onClick={() => void refreshConnections()}
        >
          <RefreshCw
            size={13}
            className={refreshing ? "spin" : undefined}
            aria-hidden="true"
          />
        </button>
        <button
          className={
            activeJobs.length ? "status-bar-jobs active" : "status-bar-jobs"
          }
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((value) => !value)}
        >
          <Sparkles size={13} aria-hidden="true" />
          {t("generation.jobsCount", { count: activeJobs.length })}
          <ChevronUp size={13} aria-hidden="true" />
        </button>
      </div>
      {drawerOpen && (
        <aside
          ref={drawerRef}
          className="generation-drawer"
          aria-label={t("generation.jobsAria")}
          role="dialog"
        >
          <header>
            <div>
              <strong>{t("generation.jobsAria")}</strong>
              <small>
                {t("generation.activeCount", { count: activeJobs.length })}
              </small>
            </div>
            <button
              className="secondary"
              data-generation-close
              aria-label={t("generation.closeJobs")}
              onClick={() => setDrawerOpen(false)}
            >
              ×
            </button>
          </header>
          <div className="generation-drawer-list">
            {recentJobs.length ? (
              recentJobs.map((job) => (
                <article key={job.id}>
                  <div className="generation-drawer-job-heading">
                    <b>
                      {job.generationType === "image"
                        ? t("generation.image")
                        : t("generation.text")}{" "}
                      / {job.providerId}
                    </b>
                    <StatusBadge tone={jobTone(job.status)}>
                      {t(`generation.status.${job.status}`)}
                    </StatusBadge>
                  </div>
                  <p title={job.prompt}>
                    {job.prompt || t("generation.noPrompt")}
                  </p>
                  {(job.status === "queued" || job.status === "running") && (
                    <progress
                      max="100"
                      value={Math.round((job.progress ?? 0) * 100)}
                    />
                  )}
                  {job.errorMessage && <small>{job.errorMessage}</small>}
                  {job.status === "running" && (
                    <button
                      className="danger"
                      onClick={() =>
                        void window.mangai.ai.cancel(job.id).then(refreshJobs)
                      }
                    >
                      {t("generation.cancel")}
                    </button>
                  )}
                </article>
              ))
            ) : (
              <div className="panel-empty">{t("generation.empty")}</div>
            )}
          </div>
          <footer>
            <button onClick={onOpenJobs}>{t("generation.openScreen")}</button>
          </footer>
        </aside>
      )}
    </>
  );
}
