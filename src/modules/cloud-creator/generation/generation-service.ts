import crypto from "node:crypto";
import {
  cloudGenerationInputSchema,
  moderateGeneralCloudPrompt,
} from "@mangai/ai-core";
import { selectCloudProvider } from "@/lib/cloud-ai-registry";
import { cloudCreatorContext } from "../auth-context";
import type {
  CloudAiQuota,
  CloudGenerationJob,
} from "../contracts/types";

export async function getMyCloudAiQuota() {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("get_my_cloud_ai_quota");
  if (error) throw new Error("Cloud AI利用枠を読み込めませんでした。");
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
    const reason = moderation.reasons.join(", ") || "classification_required";
    throw new Error(`Cloud AI送信前確認で拒否されました: ${reason}`);
  }

  const capability = selectCloudProvider(generation);
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
  if (error || !data) {
    const reason = error?.message ?? "";
    if (reason.includes("cloud_credit_quota_exceeded"))
      throw new Error("今月のCloud AI生成creditを使い切りました。");
    if (reason.includes("cloud_cost_quota_exceeded"))
      throw new Error("今月のCloud AI費用上限に達しました。");
    if (reason.includes("cloud_daily_budget_exceeded"))
      throw new Error("本日のCloud AI運用予算に達したため停止中です。");
    if (reason.includes("cloud_generation_rate_limited"))
      throw new Error(
        "Cloud AI要求が集中しています。1分後に再試行してください。",
      );
    if (reason.includes("cloud_entitlement_inactive"))
      throw new Error("Cloud AIプランが有効ではありません。");
    if (
      reason.includes("cloud_generation_disabled") ||
      reason.includes("cloud_generation_price_unavailable")
    )
      throw new Error("Cloud AI生成は現在停止中です。");
    throw new Error("Cloud AI Jobを登録できませんでした。");
  }
  return data as string;
}

export async function listCloudGenerationJobs(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase
    .from("cloud_generation_jobs")
    .select(
      "id,project_id,page_id,kind,job_type,provider_id,model_id,status,progress,attempt_count,max_attempts,estimated_cost_micros,actual_cost_micros,output,output_asset_id,error_code,error_message,created_at,updated_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Cloud AI生成履歴を読み込めませんでした。");
  return (data ?? []) as CloudGenerationJob[];
}

export async function cancelCloudGenerationJob(jobId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("cancel_cloud_generation_job", {
    p_job_id: jobId,
  });
  if (error || !data)
    throw new Error("Cloud AI Jobをキャンセルできませんでした。");
  return data as string;
}
