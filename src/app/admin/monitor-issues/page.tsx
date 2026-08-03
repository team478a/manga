import Link from "next/link";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { AdminDataUnavailable } from "@/components/admin/AdminDataUnavailable";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateMonitorIssueTaskAction } from "./actions";

type IssueTask = {
  id: string;
  request_type: "bug" | "improvement" | "feature_request";
  workflow_step: string;
  priority: "low" | "medium" | "high" | "critical";
  status: string;
  primary_feedback_id: string | null;
  latest_feedback_id: string | null;
  occurrence_count: number;
  first_reported_at: string;
  last_reported_at: string;
  claimed_by: string | null;
  reproduction_summary: string | null;
  suggested_test_scope: string | null;
  github_issue_url: string | null;
  draft_pr_url: string | null;
  last_error: string | null;
};

type FeedbackSummary = {
  id: string;
  title: string | null;
  comment: string;
  page_url: string | null;
  environment: string | null;
  severity: string | null;
  client_context: Record<string, unknown> | null;
  attachment_path: string | null;
  public_status: string;
};

const requestLabels = { bug: "不具合", improvement: "改善依頼", feature_request: "機能リクエスト" } as const;
const priorityLabels = { low: "低", medium: "中", high: "高", critical: "緊急" } as const;
const statusLabels: Record<string, string> = {
  detected: "検知済み", queued: "自動修正待ち", claimed: "解析中", fix_ready: "修正候補あり",
  review_required: "責任者確認", resolved: "対応済み", rejected: "対応しない", failed: "自動処理失敗",
};

export default async function MonitorIssuesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  await requireAdmin();
  const { error, message } = await searchParams;
  const loaded = await safelyLoadAdminData("monitor-issues", async () => {
    const admin = createAdminClient();
    const tasksResult = await admin
      .from("cloud_monitor_issue_tasks")
      .select("id,request_type,workflow_step,priority,status,primary_feedback_id,latest_feedback_id,occurrence_count,first_reported_at,last_reported_at,claimed_by,reproduction_summary,suggested_test_scope,github_issue_url,draft_pr_url,last_error")
      .order("last_reported_at", { ascending: false })
      .limit(100)
      .returns<IssueTask[]>();
    const feedbackIds = [...new Set((tasksResult.data ?? []).flatMap((task) => [task.latest_feedback_id, task.primary_feedback_id]).filter(Boolean))] as string[];
    const feedbackResult = feedbackIds.length
      ? await admin.from("cloud_general_monitor_feedback")
        .select("id,title,comment,page_url,environment,severity,client_context,attachment_path,public_status")
        .in("id", feedbackIds)
        .returns<FeedbackSummary[]>()
      : { data: [] as FeedbackSummary[], error: null };
    return { admin, tasksResult, feedbackResult };
  });
  if (!loaded.ok) return <AdminDataUnavailable title="報告・自動修正キュー" />;
  const { admin, tasksResult, feedbackResult } = loaded.value;
  const feedback = new Map((feedbackResult.data ?? []).map((item) => [item.id, item]));
  const attachmentPaths = [...new Set((feedbackResult.data ?? []).map((item) => item.attachment_path).filter(Boolean))] as string[];
  const attachmentUrls = new Map<string, string>();
  await Promise.allSettled(attachmentPaths.map(async (path) => {
    const { data } = await admin.storage.from("monitor-feedback").createSignedUrl(path, 600);
    if (data?.signedUrl) attachmentUrls.set(path, data.signedUrl);
  }));
  const openTasks = (tasksResult.data ?? []).filter((task) => !["resolved", "rejected"].includes(task.status));

  return (
    <main className="page max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link className="text-sm font-semibold text-violet-700" href="/admin">← 管理者ダッシュボード</Link>
          <h1 className="mt-3 text-3xl font-bold">報告・自動修正キュー</h1>
          <p className="mt-2 text-stone-600">不具合・改善依頼を重複検知し、安全な修正作業キューとして管理します。</p>
        </div>
        <Link className="button-secondary" href="/admin/general-monitors">すべてのモニター報告</Link>
      </div>
      <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        自動処理は再現確認・テスト・Draft PR作成までを対象とします。自動マージと本番デプロイは行いません。
      </section>
      {error ? <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{error}</p> : null}
      {message ? <p className="mt-5 rounded-xl bg-green-50 p-4 text-green-800" role="status">{message}</p> : null}
      {tasksResult.error ? (
        <p className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-950" role="alert">
          自動修正キュー用migrationが未適用です。適用後に再読み込みしてください。
        </p>
      ) : null}

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="panel"><dt className="text-sm text-stone-500">未完了</dt><dd className="mt-1 text-3xl font-bold">{openTasks.length}</dd></div>
        <div className="panel"><dt className="text-sm text-stone-500">緊急・高優先度</dt><dd className="mt-1 text-3xl font-bold">{openTasks.filter((item) => ["critical", "high"].includes(item.priority)).length}</dd></div>
        <div className="panel"><dt className="text-sm text-stone-500">重複報告数</dt><dd className="mt-1 text-3xl font-bold">{openTasks.reduce((sum, item) => sum + Math.max(0, item.occurrence_count - 1), 0)}</dd></div>
      </dl>

      <section className="mt-7 space-y-4">
        {(tasksResult.data ?? []).map((task) => {
          const latest = task.latest_feedback_id ? feedback.get(task.latest_feedback_id) : undefined;
          return (
            <article className="panel" key={task.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-900">{requestLabels[task.request_type]}</span>
                    <span className={`rounded-full px-2 py-1 ${task.priority === "critical" ? "bg-red-100 text-red-900" : task.priority === "high" ? "bg-amber-100 text-amber-950" : "bg-stone-100 text-stone-800"}`}>優先度 {priorityLabels[task.priority]}</span>
                    <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-800">{statusLabels[task.status] ?? task.status}</span>
                    {task.occurrence_count > 1 ? <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-900">同種 {task.occurrence_count}件</span> : null}
                  </div>
                  <h2 className="mt-3 break-words text-xl font-bold">{latest?.title || `${task.workflow_step}の報告`}</h2>
                  <p className="mt-2 whitespace-pre-wrap break-words text-stone-700">{latest?.comment || "報告内容を読み込めませんでした。"}</p>
                  <div className="mt-3 space-y-1 text-xs text-stone-500">
                    {latest?.page_url ? <p className="break-all">画面: {latest.page_url}</p> : null}
                    {latest?.environment ? <p>環境: {latest.environment}</p> : null}
                    {latest?.client_context ? <p>診断: {String(latest.client_context.pathname ?? "画面不明")}・{String(latest.client_context.timezone ?? "地域不明")}</p> : null}
                    {latest?.attachment_path && attachmentUrls.get(latest.attachment_path) ? <p><a className="font-semibold text-violet-700" href={attachmentUrls.get(latest.attachment_path)} rel="noreferrer" target="_blank">添付画像を確認</a></p> : null}
                    <p>初回 {new Date(task.first_reported_at).toLocaleString("ja-JP")}・最終 {new Date(task.last_reported_at).toLocaleString("ja-JP")}</p>
                  </div>
                  {task.reproduction_summary ? <p className="mt-3 rounded-lg bg-stone-50 p-3 text-sm"><strong>自動解析:</strong> {task.reproduction_summary}</p> : null}
                  {task.last_error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{task.last_error}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-violet-700">
                    {task.github_issue_url ? <a href={task.github_issue_url} rel="noreferrer" target="_blank">GitHub Issue</a> : null}
                    {task.draft_pr_url ? <a href={task.draft_pr_url} rel="noreferrer" target="_blank">Draft PR</a> : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {["detected", "review_required", "failed"].includes(task.status) ? (
                    <form action={updateMonitorIssueTaskAction}>
                      <input name="taskId" type="hidden" value={task.id} />
                      <input name="operation" type="hidden" value={task.status === "failed" ? "retry" : "queue"} />
                      <PendingSubmitButton className="button bg-violet-700 hover:bg-violet-800" pendingLabel="追加中…">
                        {task.status === "failed" ? "再試行" : "自動修正を許可"}
                      </PendingSubmitButton>
                    </form>
                  ) : null}
                  {!['resolved','rejected'].includes(task.status) ? (
                    <>
                      <form action={updateMonitorIssueTaskAction}>
                        <input name="taskId" type="hidden" value={task.id} /><input name="operation" type="hidden" value="resolve" />
                        <PendingSubmitButton className="button-secondary" pendingLabel="更新中…">対応済み</PendingSubmitButton>
                      </form>
                      <form action={updateMonitorIssueTaskAction}>
                        <input name="taskId" type="hidden" value={task.id} /><input name="operation" type="hidden" value="reject" />
                        <PendingSubmitButton className="button-secondary" pendingLabel="更新中…">対応しない</PendingSubmitButton>
                      </form>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
        {!tasksResult.data?.length && !tasksResult.error ? <p className="panel text-stone-600">分類対象の報告はまだありません。</p> : null}
      </section>
    </main>
  );
}
