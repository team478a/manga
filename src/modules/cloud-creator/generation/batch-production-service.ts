import crypto from "node:crypto";
import { cloudGenerationInputSchema } from "@mangai/ai-core";
import { cloudCreatorContext } from "../auth-context";
import { DomainError, ValidationError } from "@/lib/domain-errors";
import { enqueueStoryboardPanelImage } from "@/lib/cloud-panel-image-generation-server";
import {
  normalizeGenerationBatchPageIds,
  planGenerationBatchTargets,
  summarizeGenerationBatches,
  type MangaGenerationBatch,
} from "../../manga/domain/generation-batch";
import {
  cancelCloudGenerationJob,
  enqueueCloudGenerationJob,
} from "./generation-service";
import { assertCloudGenerationBatchPreflight } from "./batch-preflight-service";

export type CloudGenerationBatch = MangaGenerationBatch;

export async function startCloudPageGenerationBatch(projectId: string, pageIds: string[]) {
  const uniquePageIds = normalizeGenerationBatchPageIds(pageIds);
  const { supabase } = await cloudCreatorContext();
  const productionStates = await supabase.from("cloud_pages")
    .select("id,production_status").eq("project_id", projectId).in("id", uniquePageIds).is("deleted_at", null);
  if (productionStates.error && productionStates.error.code !== "42703")
    throw new DomainError("INTERNAL_ERROR", "ページの制作状態を確認できませんでした。", { cause: productionStates.error });
  if ((productionStates.data ?? []).some((page) => page.production_status === "finalized"))
    throw new ValidationError("確定済みページは一括生成できません。編集を再開してから実行してください。");
  await assertCloudGenerationBatchPreflight(projectId, uniquePageIds);
  const snapshots = await supabase
    .from("cloud_pages")
    .select("id,revision,cloud_canvas_snapshots!inner(canvas,revision)")
    .eq("project_id", projectId)
    .in("id", uniquePageIds)
    .is("deleted_at", null);
  if (snapshots.error)
    throw new DomainError("INTERNAL_ERROR", "一括生成対象を読み込めませんでした。", { cause: snapshots.error });
  const targets = planGenerationBatchTargets({
    requestedPageIds: uniquePageIds,
    pages: snapshots.data ?? [],
  });
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
    let unattachedJobIds: string[] = [];
    try {
      const result = await enqueueStoryboardPanelImage({
        projectId,
        pageId: target.pageId,
        panelId: target.panelId,
        idempotencyKey: crypto.randomUUID(),
        candidateCount: 1,
        generationTarget: "composite",
      });
      unattachedJobIds = result.jobs.map((job) => job.id);
      for (const job of result.jobs) {
        const attached = await supabase.rpc("attach_cloud_generation_batch_job", {
          p_batch_id: created.data,
          p_job_id: job.id,
        });
        if (attached.error) throw attached.error;
        unattachedJobIds = unattachedJobIds.filter((jobId) => jobId !== job.id);
        queued += 1;
      }
    } catch (error) {
      await Promise.all(
        unattachedJobIds.map((jobId) =>
          cancelCloudGenerationJob(jobId).catch(() => undefined),
        ),
      );
      if (!queued) {
        const canceled = await supabase.rpc("set_cloud_generation_batch_state", {
          p_batch_id: created.data,
          p_status: "canceled",
        });
        if (canceled.error)
          throw new DomainError("INTERNAL_ERROR", "一括生成を開始できませんでした。", {
            cause: canceled.error,
          });
        throw error;
      }
      break;
    }
  }
  return {
    batchId: created.data as string,
    queued,
    requested: targets.length,
    partial: queued !== targets.length,
  };
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
  return summarizeGenerationBatches({
    batches: (batches.data ?? []) as Array<{
      id: string; status: CloudGenerationBatch["status"]; requested_page_ids: string[]; created_at: string;
    }>,
    links: (links.data ?? []).map((link) => {
      const joined = Array.isArray(link.cloud_generation_jobs) ? link.cloud_generation_jobs[0] : link.cloud_generation_jobs;
      return { batch_id: link.batch_id, job_id: link.job_id, status: joined?.status as string };
    }),
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
