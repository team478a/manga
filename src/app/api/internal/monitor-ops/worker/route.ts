import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { featureFlagEnabled } from "@/lib/feature-flags";
import { hasValidInternalWorkerAuthorization } from "@/lib/internal-worker-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim"), workerId: z.string().trim().min(1).max(200) }),
  z.object({
    action: z.literal("complete"),
    taskId: z.string().uuid(),
    status: z.enum(["fix_ready", "review_required", "failed"]),
    reproductionSummary: z.string().trim().max(3000).optional().default(""),
    suggestedTestScope: z.string().trim().max(1000).optional().default(""),
    githubIssueUrl: z.string().url().max(500).optional().or(z.literal("")).default(""),
    draftPrUrl: z.string().url().max(500).optional().or(z.literal("")).default(""),
    errorMessage: z.string().trim().max(1000).optional().default(""),
  }),
]);

function authorized(request: Request) {
  return hasValidInternalWorkerAuthorization(
    request,
    process.env.MANGAI_MONITOR_OPS_WORKER_SECRET,
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "認証できません。" }, { status: 401 });
  if (!featureFlagEnabled("MANGAI_MONITOR_OPS_WORKER_ENABLED")) {
    return NextResponse.json({ error: "自動修正Workerは停止中です。" }, { status: 503 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });
  const admin = createAdminClient();
  if (parsed.data.action === "claim") {
    const claimed = await admin.rpc("claim_cloud_monitor_issue_task", { p_worker_id: parsed.data.workerId });
    if (claimed.error) return NextResponse.json({ error: "修正タスクを取得できませんでした。" }, { status: 503 });
    const task = Array.isArray(claimed.data) ? claimed.data[0] : null;
    if (!task) return NextResponse.json({ task: null });
    const feedback = task.latest_feedback_id
      ? await admin.from("cloud_general_monitor_feedback")
        .select("id,request_type,title,workflow_step,severity,page_url,environment,comment,created_at")
        .eq("id", task.latest_feedback_id)
        .maybeSingle()
      : { data: null, error: null };
    return NextResponse.json({
      task: {
        id: task.id,
        requestType: task.request_type,
        workflowStep: task.workflow_step,
        priority: task.priority,
        occurrenceCount: task.occurrence_count,
      },
      report: feedback.data,
    });
  }
  const result = await admin.rpc("complete_cloud_monitor_issue_task", {
    p_task_id: parsed.data.taskId,
    p_status: parsed.data.status,
    p_reproduction_summary: parsed.data.reproductionSummary,
    p_suggested_test_scope: parsed.data.suggestedTestScope,
    p_github_issue_url: parsed.data.githubIssueUrl,
    p_draft_pr_url: parsed.data.draftPrUrl,
    p_last_error: parsed.data.errorMessage,
  });
  if (result.error) return NextResponse.json({ error: "修正結果を保存できませんでした。" }, { status: 503 });
  return NextResponse.json({ completed: true });
}
