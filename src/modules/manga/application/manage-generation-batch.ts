import crypto from "node:crypto";
import { cloudGenerationInputSchema } from "@mangai/ai-core";
import { pageCanvasSchema } from "@mangai/canvas-core";
import { cloudCreatorContext } from "@/modules/cloud-creator/auth-context";
import { DomainError, ResourceNotFoundError, ValidationError } from "@/lib/domain-errors";
import { enqueueStoryboardPanelImage } from "@/lib/cloud-panel-image-generation-server";
import {
  cancelCloudGenerationJob,
  enqueueCloudGenerationJob,
} from "@/modules/cloud-creator/generation/generation-service";

export type CloudGenerationBatch = {
  id: string;
  status: "active" | "paused" | "completed" | "canceled";
  requested_page_ids: string[];
  created_at: string;
  totalJobs: number;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  failedJobIds: string[];
};

export async function startCloudPageGenerationBatch(projectId: string, pageIds: string[]) {
  const uniquePageIds = [...new Set(pageIds)];
  if (uniquePageIds.length < 4 || uniquePageIds.length > 8)
    throw new ValidationError("一括生成するページを4〜8ページ選んでください。");
  const { supabase } = await cloudCreatorContext();
  const productionStates = await supabase.from("cloud_pages")
    .select("id,production_status").eq("project_id", projectId).in("id", uniquePageIds).is("deleted_at", null);
  if (productionStates.error && productionStates.error.code !== "42703")
    throw new DomainError("INTERNAL_ERROR", "ページの制作状態を確認できませんでした。", { cause: productionStates.error });
  if ((productionStates.data ?? []).some((page) => page.production_status === "finalized"))
    throw new ValidationError("確定済みページは一括生成できません。編集を再開してから実行してください。");
  const snapshots = await supabase
    .from("cloud_pages")
    .select("id,revision,cloud_canvas_snapshots!inner(canvas,revision)")
    .eq("project_id", projectId)
    .in("id", uniquePageIds)
    .is("deleted_at", null);
  if (snapshots.error)
    throw new DomainError("INTERNAL_ERROR", "一括生成対象を読み込めませんでした。", { cause: snapshots.error });
  if ((snapshots.data?.length ?? 0) !== uniquePageIds.length)
    throw new ResourceNotFoundError("一括生成対象のページが見つかりません。");
  const targets = (snapshots.data ?? []).flatMap((page) => {
    const versions = Array.isArray(page.cloud_canvas_snapshots) ? page.cloud_canvas_snapshots : [];
    const current = versions.find((snapshot) => snapshot.revision === page.revision);
    if (!current) return [];
    const canvas = pageCanvasSchema.parse(current.canvas);
    return canvas.panels.map((panel) => ({ pageId: page.id, panelId: panel.id }));
  });
  if (!targets.length) throw new ValidationError("選択したページに生成可能なコマがありません。");
  if (targets.length > 64) throw new ValidationError("一度に生成できるコマは64個までです。ページを分けてください。");
  const batchKey = crypto.randomUUID();
  const created = await supabase.rpc("create_cloud_generation_batch", {
    p_project_id: projectId,
    p_page_ids: uniquePageIds,
    p_idempotency_key: batchKey,
  });
  if (created.error || !created.data)
    throw new DomainError("INTERNAL_ERROR", "一括生成を開始できませんでした。", { cause: created.error });
  let queued = 0;
  for (const target of targets) {
    try {
      const result = await enqueueStoryboardPanelImage({
        projectId,
        pageId: target.pageId,
        panelId: target.panelId,
        idempotencyKey: crypto.randomUUID(),
        candidateCount: 1,
        generationTarget: "composite",
      });
      for (const job of result.jobs) {
        const attached = await supabase.rpc("attach_cloud_generation_batch_job", {
          p_batch_id: created.data,
          p_job_id: job.id,
        });
        if (attached.error) throw attached.error;
        queued += 1;
      }
    } catch (error) {
      if (!queued) throw error;
      break;
    }
  }
  return { batchId: created.data as string, queued, requested: targets.length };
}
export async function listCloudGenerationBatches(projectId: string): Promise<CloudGenerationBatch[]> {
  const { supabase } = await cloudCreatorContext();
  const batches = await supabase.from("cloud_generation_batches")
    .select("id,status,requested_page_ids,created_at")
    .eq("project_id", projectId).order("created_at", { ascending: false }).limit(10);
  if (batches.error?.code === "42P01") return [];
  if (batches.error) throw new DomainError("INTERNAL_ERROR", "一括生成履歴を読み込めませんでした。", { cause: batches.error });
  const ids = (batches.data ?? []).map((batch) => batch.id);
  if (!ids.length) return [];
  const links = await supabase.from("cloud_generation_batch_jobs")
    .select("batch_id,job_id,cloud_generation_jobs!inner(status)").in("batch_id", ids);
  if (links.error) throw new DomainError("INTERNAL_ERROR", "一括生成状況を読み込めませんでした。", { cause: links.error });
  return (batches.data ?? []).map((batch) => {
    const jobs = (links.data ?? []).filter((link) => link.batch_id === batch.id).map((link) => {
      const joined = Array.isArray(link.cloud_generation_jobs) ? link.cloud_generation_jobs[0] : link.cloud_generation_jobs;
      return { id: link.job_id, status: joined?.status as string };
    });
    const count = (status: string) => jobs.filter((job) => job.status === status).length;
    const displayedStatus = batch.status === "active" && jobs.length > 0 && count("completed") === jobs.length
      ? "completed"
      : batch.status;
    return {
      ...batch,
      status: displayedStatus,
      totalJobs: jobs.length,
      queuedJobs: count("queued"), runningJobs: count("running"), completedJobs: count("completed"), failedJobs: count("failed"),
      failedJobIds: jobs.filter((job) => job.status === "failed").map((job) => job.id),
    } as CloudGenerationBatch;
  });
}

export async function setCloudGenerationBatchState(batchId: string, status: "active" | "paused" | "canceled") {
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("set_cloud_generation_batch_state", { p_batch_id: batchId, p_status: status });
  if (result.error || !result.data) throw new ValidationError("一括生成の状態を変更できませんでした。");
}

export async function retryFailedCloudGenerationJob(jobId: string) {
  const { supabase } = await cloudCreatorContext();
  const source = await supabase.from("cloud_generation_jobs")
    .select("id,project_id,page_id,status,input").eq("id", jobId).maybeSingle();
  if (source.error || !source.data || source.data.status !== "failed")
    throw new ValidationError("再実行できる失敗Jobが見つかりません。");
  const parsedGeneration = cloudGenerationInputSchema.safeParse(source.data.input);
  if (!parsedGeneration.success)
    throw new ValidationError("元の生成条件を安全に復元できないため、再実行できませんでした。");
  const generation = parsedGeneration.data;
  const newJobId = await enqueueCloudGenerationJob({
    projectId: source.data.project_id,
    pageId: source.data.page_id ?? undefined,
    idempotencyKey: `retry:${jobId}:${crypto.randomUUID()}`,
    generation,
  });
  const replaced = await supabase.rpc("replace_cloud_generation_batch_job", {
    p_failed_job_id: jobId,
    p_new_job_id: newJobId,
  });
  if (replaced.error || Number(replaced.data) < 1) {
    await cancelCloudGenerationJob(newJobId).catch(() => undefined);
    throw new DomainError("INTERNAL_ERROR", "失敗Jobを一括生成へ再登録できませんでした。", { cause: replaced.error });
  }
  return newJobId;
}
