import crypto from "node:crypto";
import { cloudGenerationInputSchema } from "@mangai/ai-core";
import { cloudCreatorContext } from "../auth-context";
import { DomainError, ValidationError } from "@/lib/domain-errors";
import { prepareStoryboardPanelImage } from "@/lib/cloud-panel-image-generation-server";
import {
  assertPreparedGenerationBatchConsistency,
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
  const preflight = await assertCloudGenerationBatchPreflight(projectId, uniquePageIds);
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
  const preparedTargets: Array<Record<string, unknown>> = [];
  for (let index = 0; index < targets.length; index += 4) {
    const preparedChunk = await Promise.all(
      targets.slice(index, index + 4).map(async (target, offset) => {
        const idempotencyKey = `${batchKey}:target:${index + offset + 1}`;
        const prepared = await prepareStoryboardPanelImage({
          projectId,
          pageId: target.pageId,
          panelId: target.panelId,
          idempotencyKey,
          candidateCount: 1,
          generationTarget: "composite",
        });
        return {
          page_id: target.pageId,
          panel_id: target.panelId,
          source_page_revision: target.sourcePageRevision,
          position: index + offset + 1,
          idempotency_key: idempotencyKey,
          kind: prepared.generation.generation.kind,
          job_type: prepared.generation.generation.jobType,
          provider_id: prepared.generation.capability.providerId,
          model_id: prepared.generation.capability.modelId,
          pricing_version: prepared.generation.capability.pricingVersion,
          prompt_sha256: prepared.generation.promptSha256,
          input: prepared.generation.generation,
          moderation: prepared.generation.moderation,
          panel_specification: prepared.panelSpecification,
        };
      }),
    );
    preparedTargets.push(...preparedChunk);
  }
  if (!preflight.modelId || !preflight.pricingVersion)
    throw new ValidationError("一括生成のProvider・model・料金設定を確認できませんでした。");
  assertPreparedGenerationBatchConsistency({
    targets: preparedTargets.map((target) => ({
      providerId: String(target.provider_id),
      modelId: String(target.model_id),
      pricingVersion: String(target.pricing_version),
      generation: cloudGenerationInputSchema.parse(target.input),
    })),
    expectedProviderId: "black-forest-labs",
    expectedModelId: preflight.modelId,
    expectedPricingVersion: preflight.pricingVersion,
    requireStyleBible: true,
  });
  const created = await supabase.rpc("create_cloud_generation_batch_targets", {
    p_project_id: projectId,
    p_page_ids: uniquePageIds,
    p_idempotency_key: batchKey,
    p_targets: preparedTargets,
  });
  if (created.error || !created.data)
    throw new DomainError("INTERNAL_ERROR", "一括生成を開始できませんでした。", { cause: created.error });
  return {
    batchId: created.data as string,
    registered: targets.length,
    queued: 0,
    requested: targets.length,
    partial: false,
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
  const progress = await supabase.rpc("get_cloud_generation_batch_target_progress", {
    p_project_id: projectId,
  });
  if (progress.error && progress.error.code !== "42883")
    throw new DomainError("INTERNAL_ERROR", "一括生成の登録状況を読み込めませんでした。", { cause: progress.error });
  return summarizeGenerationBatches({
    batches: (batches.data ?? []) as Array<{
      id: string; status: CloudGenerationBatch["status"]; requested_page_ids: string[]; created_at: string;
    }>,
    links: (links.data ?? []).map((link) => {
      const joined = Array.isArray(link.cloud_generation_jobs) ? link.cloud_generation_jobs[0] : link.cloud_generation_jobs;
      return { batch_id: link.batch_id, job_id: link.job_id, status: joined?.status as string };
    }),
    targetProgress: ((progress.data ?? []) as Array<{
      batch_id: string;
      pending_targets: number;
      failed_targets: number;
    }>),
  });
}

export async function setCloudGenerationBatchState(batchId: string, status: "active" | "paused" | "canceled") {
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("set_cloud_generation_batch_state", { p_batch_id: batchId, p_status: status });
  if (result.error || !result.data) throw new ValidationError("一括生成の状態を変更できませんでした。");
}

export async function retryFailedCloudGenerationBatchTargets(batchId: string) {
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("retry_cloud_generation_batch_targets", {
    p_batch_id: batchId,
  });
  if (result.error)
    throw new ValidationError("Job化できなかったコマを再登録できませんでした。");
  return Number(result.data ?? 0);
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
