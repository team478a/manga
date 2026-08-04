"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { DomainError } from "@/lib/domain-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  cloudGeneralImageModelSchema,
  setCloudGeneralImageSettings,
} from "@/lib/cloud-general-image-settings";
import {
  getCloudAiWorkerConfiguration,
  getCloudAiWorkerInvocationUrl,
} from "@/lib/cloud-ai-worker-admin";

const micros = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const workerResultSchema = z.object({
  status: z.enum([
    "idle",
    "completed",
    "canceled",
    "lease_lost",
    "retrying",
    "resolved",
  ]),
  jobId: z.string().uuid().optional(),
});

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function audit(input: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("cloud_ai_admin_audit_logs").insert({
    actor_profile_id: input.actorId,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    before_value: input.before,
    after_value: input.after,
  });
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "管理操作の監査ログを保存できませんでした。",
      { cause: error },
    );
}

export async function runCloudAiWorkerOnceAction() {
  const { profile } = await requireAdmin();
  const configuration = getCloudAiWorkerConfiguration();
  const workerUrl = getCloudAiWorkerInvocationUrl();
  const secret = process.env.MANGAI_CLOUD_AI_WORKER_SECRET;
  if (!configuration.ready || !workerUrl || !secret)
    redirect(
      `/admin/cloud-ai?error=${encodeURIComponent(
        "Worker環境設定を確認してください。公開チェック画面に必要な手順を表示しています",
      )}`,
    );

  let result: z.infer<typeof workerResultSchema>;
  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(175_000),
    });
    if (!response.ok) throw new Error("worker_request_failed");
    const parsed = workerResultSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("worker_response_invalid");
    result = parsed.data;
  } catch {
    redirect(
      `/admin/cloud-ai?error=${encodeURIComponent(
        "Workerを実行できませんでした。環境設定とデプロイ状態を確認してください",
      )}`,
    );
  }

  await audit({
    actorId: profile.id,
    action: "run_worker_once",
    targetType: "cloud_ai_worker",
    targetId: result.jobId ?? "queue",
    before: null,
    after: { status: result.status },
  });
  revalidatePath("/admin/cloud-ai");
  const message =
    result.status === "idle"
      ? "Workerを実行しました。処理待ちJobはありません"
      : result.status === "completed"
        ? "WorkerがCloud AI Jobを1件完了しました"
        : result.status === "canceled"
          ? "Workerがキャンセル済みJobを確認しました"
          : result.status === "lease_lost"
            ? "Workerの処理権限が更新されました。Queue状態を再確認してください"
            : "Workerを実行しました。Queue状態を再確認してください";
  redirect(`/admin/cloud-ai?message=${encodeURIComponent(message)}`);
}

export async function cancelCloudAiJobAction(jobId: string) {
  const { profile } = await requireAdmin();
  const parsedJobId = z.string().uuid().safeParse(jobId);
  if (!parsedJobId.success)
    redirect(encodeURI("/admin/cloud-ai?error=Job IDを確認してください"));

  const admin = createAdminClient();
  const { data: before, error: loadError } = await admin
    .from("cloud_generation_jobs")
    .select("id,status,project_id,created_by_profile_id,job_type,created_at")
    .eq("id", parsedJobId.data)
    .maybeSingle();
  if (loadError || !before || !["queued", "running"].includes(before.status))
    redirect(
      `/admin/cloud-ai?error=${encodeURIComponent(
        "このJobは取消できない状態です。画面を再読み込みしてください",
      )}`,
    );

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_cloud_generation_job", {
    p_job_id: parsedJobId.data,
  });
  if (error)
    redirect(
      `/admin/cloud-ai?error=${encodeURIComponent(
        "Jobを取消できませんでした。状態を確認してから再度お試しください",
      )}`,
    );

  await audit({
    actorId: profile.id,
    action: "cancel_generation_job",
    targetType: "cloud_generation_job",
    targetId: parsedJobId.data,
    before,
    after: { status: "canceled" },
  });
  revalidatePath("/admin/cloud-ai");
  redirect(
    `/admin/cloud-ai?message=${encodeURIComponent("Cloud AI Jobを取消しました")}`,
  );
}

export async function updateCloudAiSettingsAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const parsed = z
    .object({
      generationEnabled: z.enum(["true", "false"]),
      dailyCostLimitMicros: micros,
      warningPercent: z.coerce.number().int().min(1).max(100),
    })
    .safeParse({
      generationEnabled: field(formData, "generationEnabled"),
      dailyCostLimitMicros: field(formData, "dailyCostLimitMicros"),
      warningPercent: field(formData, "warningPercent"),
    });
  if (!parsed.success)
    redirect(encodeURI("/admin/cloud-ai?error=運用設定を確認してください"));
  const admin = createAdminClient();
  const { data: before } = await admin
    .from("cloud_ai_settings")
    .select("generation_enabled,daily_cost_limit_micros,warning_percent")
    .eq("singleton", true)
    .single();
  const after = {
    generation_enabled: parsed.data.generationEnabled === "true",
    daily_cost_limit_micros: parsed.data.dailyCostLimitMicros,
    warning_percent: parsed.data.warningPercent,
  };
  const { error } = await admin
    .from("cloud_ai_settings")
    .update(after)
    .eq("singleton", true);
  if (error)
    redirect(
      `/admin/cloud-ai?error=${encodeURIComponent("Cloud AI運用設定を更新できませんでした")}`,
    );
  await audit({
    actorId: profile.id,
    action: "update_settings",
    targetType: "cloud_ai_settings",
    targetId: "global",
    before,
    after,
  });
  revalidatePath("/admin/cloud-ai");
  redirect(encodeURI("/admin/cloud-ai?message=Cloud AI運用設定を更新しました"));
}

export async function updateCloudGeneralImageProviderAction(
  formData: FormData,
) {
  const { profile } = await requireAdmin();
  const parsed = z
    .object({
      apiKey: z.string().trim().max(500),
      model: cloudGeneralImageModelSchema,
      enabled: z.enum(["true", "false"]),
    })
    .safeParse({
      apiKey: field(formData, "apiKey"),
      model: field(formData, "model"),
      enabled: field(formData, "enabled"),
    });
  if (!parsed.success)
    redirect(encodeURI("/admin/cloud-ai?error=画像生成AI設定を確認してください"));
  try {
    await setCloudGeneralImageSettings({
      actorProfileId: profile.id,
      apiKey: parsed.data.apiKey,
      model: parsed.data.model,
      enabled: parsed.data.enabled === "true",
    });
  } catch {
    redirect(
      `/admin/cloud-ai?error=${encodeURIComponent(
        "画像生成AI設定を保存できませんでした。migrationとAPIキーを確認してください",
      )}`,
    );
  }
  revalidatePath("/admin/cloud-ai");
  redirect(
    encodeURI("/admin/cloud-ai?message=一般向け画像生成AI設定を保存しました"),
  );
}

export async function updateCloudAiPlanAction(
  planKey: string,
  formData: FormData,
) {
  const { profile } = await requireAdmin();
  const parsed = z
    .object({
      monthlyCredits: z.coerce.number().int().min(0).max(10_000_000),
      monthlyCostLimitMicros: micros,
      userRate: z.coerce.number().int().min(1).max(1000),
      projectRate: z.coerce.number().int().min(1).max(1000),
      active: z.enum(["true", "false"]),
    })
    .safeParse({
      monthlyCredits: field(formData, "monthlyCredits"),
      monthlyCostLimitMicros: field(formData, "monthlyCostLimitMicros"),
      userRate: field(formData, "userRate"),
      projectRate: field(formData, "projectRate"),
      active: field(formData, "active"),
    });
  if (!parsed.success || !["free", "trial", "creator"].includes(planKey))
    redirect(encodeURI("/admin/cloud-ai?error=Plan設定を確認してください"));
  const admin = createAdminClient();
  const { data: before } = await admin
    .from("cloud_ai_plans")
    .select("*")
    .eq("plan_key", planKey)
    .single();
  const after = {
    monthly_credits: parsed.data.monthlyCredits,
    monthly_cost_limit_micros: parsed.data.monthlyCostLimitMicros,
    user_requests_per_minute: parsed.data.userRate,
    project_requests_per_minute: parsed.data.projectRate,
    active: parsed.data.active === "true",
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin
    .from("cloud_ai_plans")
    .update(after)
    .eq("plan_key", planKey);
  if (error)
    redirect(
      `/admin/cloud-ai?error=${encodeURIComponent("Cloud AI Plan設定を更新できませんでした")}`,
    );
  await audit({ actorId: profile.id, action: "update_plan", targetType: "cloud_ai_plan", targetId: planKey, before, after });
  revalidatePath("/admin/cloud-ai");
  redirect(encodeURI("/admin/cloud-ai?message=Plan設定を更新しました"));
}

export async function createCloudAiPriceAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const parsed = z.object({
    providerId: z.string().trim().min(1).max(100),
    modelId: z.string().trim().min(1).max(200),
    kind: z.enum(["image", "text"]),
    jobType: z.enum(["background", "prop", "effect", "character_base", "story", "storyboard", "speech_bubble"]),
    pricingVersion: z.string().trim().min(1).max(100),
    credits: z.coerce.number().int().min(1).max(1000),
    maxCostMicros: micros,
    currency: z.string().trim().regex(/^[A-Z]{3}$/),
  }).safeParse({
    providerId: field(formData,"providerId"), modelId: field(formData,"modelId"),
    kind: field(formData,"kind"), jobType: field(formData,"jobType"),
    pricingVersion: field(formData,"pricingVersion"), credits: field(formData,"credits"),
    maxCostMicros: field(formData,"maxCostMicros"), currency: field(formData,"currency").toUpperCase(),
  });
  if (!parsed.success) redirect(encodeURI("/admin/cloud-ai?error=価格情報を確認してください"));
  const admin = createAdminClient();
  const values = {
    provider_id: parsed.data.providerId, model_id: parsed.data.modelId,
    kind: parsed.data.kind, job_type: parsed.data.jobType,
    pricing_version: parsed.data.pricingVersion, credits: parsed.data.credits,
    max_cost_micros: parsed.data.maxCostMicros, currency: parsed.data.currency, active: false,
  };
  const { data, error } = await admin.from("cloud_ai_provider_prices").insert(values).select("id").single<{id:string}>();
  if (error || !data)
    redirect(
      `/admin/cloud-ai?error=${encodeURIComponent("価格を登録できませんでした")}`,
    );
  await audit({ actorId: profile.id, action: "create_price", targetType: "cloud_ai_provider_price", targetId: data.id, before: null, after: values });
  revalidatePath("/admin/cloud-ai");
  redirect(encodeURI("/admin/cloud-ai?message=価格versionを停止状態で登録しました"));
}

export async function setCloudAiPriceActiveAction(id: string, active: boolean) {
  const { profile } = await requireAdmin();
  const parsedPriceId = z.string().uuid().safeParse(id);
  if (!parsedPriceId.success)
    redirect(encodeURI("/admin/cloud-ai?error=価格IDを確認してください"));
  const priceId = parsedPriceId.data;
  const admin = createAdminClient();
  const { data: before } = await admin.from("cloud_ai_provider_prices").select("*").eq("id",priceId).single();
  const { error } = await admin.from("cloud_ai_provider_prices").update({active,updated_at:new Date().toISOString()}).eq("id",priceId);
  if (error)
    redirect(
      `/admin/cloud-ai?error=${encodeURIComponent(
        active
          ? "同じProvider・model・Job種別の有効価格を先に停止してください"
          : "価格versionを停止できませんでした",
      )}`,
    );
  await audit({ actorId: profile.id, action: active ? "activate_price" : "deactivate_price", targetType: "cloud_ai_provider_price", targetId: priceId, before, after: {...before,active} });
  revalidatePath("/admin/cloud-ai");
}
