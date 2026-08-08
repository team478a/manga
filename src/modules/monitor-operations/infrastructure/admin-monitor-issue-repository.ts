import { createAdminClient } from "@/lib/supabase/admin";

export type MonitorIssueTask = {
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

export type MonitorIssueFeedbackSummary = {
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

export async function loadAdminMonitorIssueWorkspace() {
  const admin = createAdminClient();
  const tasksResult = await admin
    .from("cloud_monitor_issue_tasks")
    .select("id,request_type,workflow_step,priority,status,primary_feedback_id,latest_feedback_id,occurrence_count,first_reported_at,last_reported_at,claimed_by,reproduction_summary,suggested_test_scope,github_issue_url,draft_pr_url,last_error")
    .order("last_reported_at", { ascending: false })
    .limit(100)
    .returns<MonitorIssueTask[]>();
  const feedbackIds = [
    ...new Set(
      (tasksResult.data ?? [])
        .flatMap((task) => [task.latest_feedback_id, task.primary_feedback_id])
        .filter(Boolean),
    ),
  ] as string[];
  const feedbackResult = feedbackIds.length
    ? await admin
        .from("cloud_general_monitor_feedback")
        .select("id,title,comment,page_url,environment,severity,client_context,attachment_path,public_status")
        .in("id", feedbackIds)
        .returns<MonitorIssueFeedbackSummary[]>()
    : { data: [] as MonitorIssueFeedbackSummary[], error: null };
  const attachmentPaths = [
    ...new Set(
      (feedbackResult.data ?? [])
        .map((item) => item.attachment_path)
        .filter(Boolean),
    ),
  ] as string[];
  const attachmentUrls = new Map<string, string>();
  await Promise.allSettled(
    attachmentPaths.map(async (path) => {
      const { data } = await admin.storage
        .from("monitor-feedback")
        .createSignedUrl(path, 600);
      if (data?.signedUrl) attachmentUrls.set(path, data.signedUrl);
    }),
  );
  return { tasksResult, feedbackResult, attachmentUrls };
}

export async function updateAdminMonitorIssueTask(input: {
  taskId: string;
  status: string;
  resetClaim: boolean;
}) {
  return createAdminClient()
    .from("cloud_monitor_issue_tasks")
    .update({
      status: input.status,
      updated_at: new Date().toISOString(),
      ...(input.resetClaim
        ? { claimed_by: null, claimed_at: null, last_error: null }
        : {}),
    })
    .eq("id", input.taskId);
}
