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
  const generation = cloudGenerationInputSchema.parse(input.generation);
  const moderation = moderateGeneralCloudPrompt(
    `${generation.prompt}\n${generation.negativePrompt}`,
  );
  if (moderation.decision !== "allow") {
    throw cloudModerationRejectedError(moderation.reasons);
  }

  const capability = await selectCloudProvider(generation);
  const { supabase } = await cloudCreatorContext();
  const promptSha256 = crypto
    .createHash("sha256")
    .update(generation.prompt, "utf8")
    .digest("hex");
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

export async function listCloudGenerationJobs(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase
    .from("cloud_generation_jobs")
    .select(
      "id,project_id,page_id,kind,job_type,provider_id,model_id,status,progress,attempt_count,max_attempts,estimated_cost_micros,actual_cost_micros,output,output_asset_id,error_code,error_message,created_at,updated_at,input",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "Cloud AI生成履歴を読み込めませんでした。",
      { cause: error },
    );
  return (data ?? []).map((row) => {
    const input =
      row.input && typeof row.input === "object"
        ? (row.input as Record<string, unknown>)
        : null;
    const targetPanelId =
      typeof input?.targetPanelId === "string" ? input.targetPanelId : null;
    const parsedRevisionPreset = cloudImageRevisionPresetSchema.safeParse(
      input?.revisionPreset,
    );
    const revisionPreset = parsedRevisionPreset.success
      ? parsedRevisionPreset.data
      : null;
    const generationOperation =
      input?.operation === "text_to_image" ||
      input?.operation === "image_to_image" ||
      input?.operation === "inpainting"
        ? input.operation
        : null;
    const { input: _privateInput, ...publicRow } = row;
    return {
      ...publicRow,
      target_panel_id: targetPanelId,
      revision_preset: revisionPreset,
      generation_operation: generationOperation,
    } as CloudGenerationJob;
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
