import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { toApiError } from "@/lib/api-errors";
import {
  getCloudPageSnapshot,
  listCloudGenerationJobs,
} from "@/lib/cloud-creator-server";
import { requireCloudGeneralMonitor } from "@/lib/cloud-general-monitor";
import { ValidationError } from "@/lib/domain-errors";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  projectId: z.string().uuid(),
  pageId: z.string().uuid(),
  panelId: z.string().trim().min(1).max(100).nullable(),
  verdict: z.enum(["accepted", "needs_revision", "unusable"]),
  issueType: z.enum([
    "none", "face", "hands", "composition", "consistency", "text",
    "image_quality", "missing_content", "operation", "other",
  ]),
  severity: z.enum(["none", "minor", "major", "blocked"]),
  comment: z.string().trim().max(1000),
});

const verdictDefaults = {
  accepted: { rating: 5, outcome: "very_useful", comment: "このまま採用できます。" },
  needs_revision: { rating: 3, outcome: "difficult", comment: "修正が必要です。" },
  unusable: { rating: 1, outcome: "blocked", comment: "この結果は利用できません。" },
} as const;

export async function POST(request: Request) {
  try {
    const { profile } = await requireProfile();
    await requireCloudGeneralMonitor(profile.id);
    const input = schema.parse(await request.json());
    const snapshot = await getCloudPageSnapshot(input.pageId);
    if (snapshot.project_id !== input.projectId)
      throw new ValidationError("作品とページが一致しません。");
    const panel = input.panelId
      ? snapshot.canvas.panels.find((candidate) => candidate.id === input.panelId)
      : null;
    if (input.panelId && !panel)
      throw new ValidationError("選択したコマが見つかりません。");
    if (input.verdict === "accepted" && (input.issueType !== "none" || input.severity !== "none"))
      throw new ValidationError("採用できる場合は問題なしを選択してください。");
    if (input.verdict !== "accepted" && (input.issueType === "none" || input.severity === "none"))
      throw new ValidationError("修正箇所と影響度を選択してください。");

    const jobs = (await listCloudGenerationJobs(input.projectId)).filter(
      (job) => job.page_id === input.pageId && (!input.panelId || job.target_panel_id === input.panelId),
    );
    const latestJob = jobs[0] ?? null;
    const completedJobs = jobs.filter((job) => job.status === "completed");
    const generationCostMicros = jobs.reduce(
      (sum, job) => sum + (job.actual_cost_micros ?? 0),
      0,
    );
    const generationElapsedMs = jobs.reduce((sum, job) => {
      const start = Date.parse(job.created_at);
      const end = Date.parse(job.updated_at);
      return sum + (Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0);
    }, 0);
    const defaults = verdictDefaults[input.verdict];
    const { error } = await (await createClient())
      .from("cloud_general_monitor_feedback")
      .insert({
        owner_profile_id: profile.id,
        workflow_step: input.panelId ? "panel_image" : "canvas",
        rating: defaults.rating,
        outcome: defaults.outcome,
        comment: input.comment || defaults.comment,
        target_scope: input.panelId ? "panel" : "page",
        project_id: input.projectId,
        page_id: input.pageId,
        panel_id: input.panelId,
        page_number_snapshot: snapshot.page_number,
        panel_name_snapshot: panel?.name ?? null,
        verdict: input.verdict,
        issue_type: input.issueType,
        severity: input.severity,
        generation_job_id: latestJob?.id ?? null,
        provider_id: latestJob?.provider_id ?? null,
        model_id: latestJob?.model_id ?? null,
        generation_count: completedJobs.length,
        generation_cost_micros: generationCostMicros,
        generation_elapsed_ms: generationElapsedMs,
      });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toApiError(error, "品質フィードバックを保存できませんでした。");
    return NextResponse.json(response.body, { status: response.status });
  }
}
