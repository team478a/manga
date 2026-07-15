import React from "react";
import type { ProviderSettings } from "@mangai/ai-core";
import { Bot, ChevronUp, RefreshCw, Sparkles } from "lucide-react";
import { StatusBadge, type StatusTone } from "../common/StatusBadge";

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

const jobLabel: Record<GenerationJob["status"], string> = {
  queued: "待機中",
  running: "生成中",
  completed: "完了",
  failed: "失敗",
  canceled: "キャンセル",
};

export function WorkspaceStatusControls({
  projectId,
  onOpenJobs,
  onOpenSettings,
}: {
  projectId: string;
  onOpenJobs: () => void;
  onOpenSettings: () => void;
}) {
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
              ? { status: "checking", message: "接続確認中…" }
              : { status: "disabled", message: "設定で無効です" },
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
  }, []);

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
      ?.querySelector<HTMLElement>('button[aria-label="生成ジョブを閉じる"]')
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
              title={`${providerLabel[id]}: ${state?.message ?? "確認待ち"}${state?.latencyMs !== undefined ? ` (${state.latencyMs}ms)` : ""}`}
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
          aria-label="AI接続状態を更新"
          title="AI接続状態を更新"
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
          生成ジョブ {activeJobs.length}
          <ChevronUp size={13} aria-hidden="true" />
        </button>
      </div>
      {drawerOpen && (
        <aside
          ref={drawerRef}
          className="generation-drawer"
          aria-label="生成ジョブ"
          role="dialog"
        >
          <header>
            <div>
              <strong>生成ジョブ</strong>
              <small>{activeJobs.length}件を実行中</small>
            </div>
            <button
              className="secondary"
              aria-label="生成ジョブを閉じる"
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
                      {job.generationType === "image" ? "画像" : "文章"} /{" "}
                      {job.providerId}
                    </b>
                    <StatusBadge tone={jobTone(job.status)}>
                      {jobLabel[job.status]}
                    </StatusBadge>
                  </div>
                  <p title={job.prompt}>{job.prompt || "プロンプトなし"}</p>
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
                      キャンセル
                    </button>
                  )}
                </article>
              ))
            ) : (
              <div className="panel-empty">生成履歴はまだありません。</div>
            )}
          </div>
          <footer>
            <button onClick={onOpenJobs}>生成画面を開く</button>
          </footer>
        </aside>
      )}
    </>
  );
}
