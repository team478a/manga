import crypto from "node:crypto";
import {
  cloudGenerationInputSchema,
  cloudImageRevisionPresetSchema,
  moderateGeneralCloudPrompt,
} from "@mangai/ai-core";
import { selectCloudProvider } from "@/lib/cloud-ai-registry";
import { cloudCreatorContext } from "../auth-context";
import type {
  CloudAiQuota,
  CloudGenerationJob,
} from "../contracts/types";
import {
  cloudModerationRejectedError,
  mapCloudGenerationEnqueueError,
} from "./generation-errors";
import {
  DomainError,
  ValidationError,
} from "@/lib/domain-errors";

export async function getMyCloudAiQuota() {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("get_my_cloud_ai_quota");
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "Cloud AI利用枠を読み込めませんでした。",
      { cause: error },
    );
  return ((data ?? [])[0] ?? null) as CloudAiQuota | null;
}

export async function enqueueCloudGenerationJob(input: {
  projectId: string;
  pageId?: string;
  idempotencyKey: string;
  generation: unknown;
}) {
  const prepared = await prepareCloudGenerationJob(input.generation);
  const { generation, moderation, capability, promptSha256 } = prepared;
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc(
    "enqueue_cloud_generation_job_with_quota",
    {
      p_project_id: input.projectId,
      p_page_id: input.pageId ?? null,
      p_kind: generation.kind,
      p_job_type: generation.jobType,
      p_provider_id: capability.providerId,
      p_model_id: capability.modelId,
      p_idempotency_key: input.idempotencyKey,
      p_prompt_sha256: promptSha256,
      p_input: generation,
      p_moderation: moderation,
    },
  );
  if (error || !data) throw mapCloudGenerationEnqueueError(error);
  return data as string;
}

export async function prepareCloudGenerationJob(input: unknown) {
  const generation = cloudGenerationInputSchema.parse(input);
  const moderation = moderateGeneralCloudPrompt(
    `${generation.prompt}\n${generation.negativePrompt}`,
  );
  if (moderation.decision !== "allow") {
    throw cloudModerationRejectedError(moderation.reasons);
  }

  const capability = await selectCloudProvider(generation);
  const promptSha256 = crypto
    .createHash("sha256")
    .update(generation.prompt, "utf8")
    .digest("hex");
  return { generation, moderation, capability, promptSha256 };
}

export async function listCloudGenerationJobs(
  projectId: string,
  pageId?: string,
) {
  const { supabase } = await cloudCreatorContext();
  let query = supabase
    .from("cloud_generation_jobs")
    .select(
      "id,project_id,page_id,kind,job_type,provider_id,model_id,status,progress,attempt_count,max_attempts,estimated_cost_micros,actual_cost_micros,output,output_asset_id,error_code,error_message,created_at,updated_at,input",
    )
    .eq("project_id", projectId);
  if (pageId) query = query.eq("page_id", pageId);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(100);
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "Cloud AI生成履歴を読み込めませんでした。",
      { cause: error },
    );
  let publicRows = (data ?? []).map((row) => {
    const input =
      row.input && typeof row.input === "object"
        ? (row.input as Record<string, unknown>)
        : null;
    const targetPanelId =
      typeof input?.targetPanelId === "string" ? input.targetPanelId : null;
    const sourceAssetId =
      typeof input?.sourceAssetId === "string" ? input.sourceAssetId : null;
    const outpaintingDirection =
      input?.outpaintingDirection === "left" ||
      input?.outpaintingDirection === "right" ||
      input?.outpaintingDirection === "top" ||
      input?.outpaintingDirection === "bottom" ||
      input?.outpaintingDirection === "all"
        ? input.outpaintingDirection
        : null;
    const parsedRevisionPreset = cloudImageRevisionPresetSchema.safeParse(
      input?.revisionPreset,
    );
    const revisionPreset = parsedRevisionPreset.success
      ? parsedRevisionPreset.data
      : null;
    const generationOperation =
      input?.operation === "text_to_image" ||
      input?.operation === "image_to_image" ||
      input?.operation === "inpainting" ||
      input?.operation === "outpainting"
        ? input.operation
        : null;
    const { input: _privateInput, ...publicRow } = row;
    return {
      ...publicRow,
      panel_adoption_eligible: input?.autoAdopt === true,
      panel_adoption_status: null,
      panel_adoption_retryable: false,
      target_panel_id: targetPanelId,
      source_asset_id: sourceAssetId,
      outpainting_direction: outpaintingDirection,
      revision_preset: revisionPreset,
      generation_operation: generationOperation,
    } as CloudGenerationJob;
  });
  const completedIds = publicRows
    .filter((row) => row.status === "completed" && row.target_panel_id)
    .map((row) => row.id);
  if (!completedIds.length) return publicRows;
  const [evaluations, adoptions] = await Promise.all([
    supabase
      .from("cloud_manga_quality_evaluations")
      .select("generation_job_id,overall_score")
      .in("generation_job_id", completedIds),
    supabase
      .from("cloud_generation_panel_adoptions")
      .select("generation_job_id,status,retryable")
      .in("generation_job_id", completedIds),
  ]);
  if (!adoptions.error) {
    const adoptionByJobId = new Map(
      (adoptions.data ?? []).map((item) => [item.generation_job_id, item]),
    );
    publicRows = publicRows.map((row) => {
      const adoption = adoptionByJobId.get(row.id);
      return adoption
        ? {
            ...row,
            panel_adoption_status: adoption.status as CloudGenerationJob["panel_adoption_status"],
            panel_adoption_retryable: Boolean(adoption.retryable),
          }
        : row;
    });
  }
  if (evaluations.error) return publicRows;
  const scoreByJobId = new Map(
    (evaluations.data ?? []).map((item) => [
      item.generation_job_id,
      Number(item.overall_score),
    ]),
  );
  const rankedByPanel = new Map<string, CloudGenerationJob[]>();
  for (const row of publicRows) {
    if (row.status !== "completed" || !row.target_panel_id) continue;
    const panelRows = rankedByPanel.get(row.target_panel_id) ?? [];
    panelRows.push(row);
    rankedByPanel.set(row.target_panel_id, panelRows);
  }
  for (const [panelId, panelRows] of rankedByPanel)
    rankedByPanel.set(
      panelId,
      [...panelRows].sort((left, right) => {
        const scoreDifference =
          (scoreByJobId.get(right.id) ?? -1) -
          (scoreByJobId.get(left.id) ?? -1);
        if (scoreDifference) return scoreDifference;
        const timeDifference =
          Date.parse(right.created_at) - Date.parse(left.created_at);
        return timeDifference || left.id.localeCompare(right.id);
      }),
    );
  const panelOffsets = new Map<string, number>();
  return publicRows.map((row) => {
    if (row.status !== "completed" || !row.target_panel_id) return row;
    const offset = panelOffsets.get(row.target_panel_id) ?? 0;
    panelOffsets.set(row.target_panel_id, offset + 1);
    return rankedByPanel.get(row.target_panel_id)?.[offset] ?? row;
  });
}

export async function cancelCloudGenerationJob(jobId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("cancel_cloud_generation_job", {
    p_job_id: jobId,
  });
  if (error || !data)
    throw new ValidationError(
      "Cloud AI Jobをキャンセルできませんでした。",
    );
  return data as string;
}
