import { DomainError } from "@/lib/domain-errors";
import { getCloudGeneralImageSettings } from "@/lib/cloud-general-image-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildCloudAiAdminEntitlementPeriod,
  type CloudAiAdminPlanKey,
} from "@/modules/cloud-ai/domain/admin-user-entitlement";

export type CloudAiAdminUserEntitlement = {
  profile_id: string;
  plan_key: CloudAiAdminPlanKey;
  status: "active" | "trialing" | "past_due" | "canceled" | "expired";
  source: "default" | "admin" | "stripe";
  period_starts_at: string;
  period_ends_at: string;
};

export type CloudAiAdminUserUsage = {
  credits_reserved: number;
  credits_used: number;
  cost_reserved_micros: number;
  cost_actual_micros: number;
};

export async function recordCloudAiAdminAudit(input: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
}) {
  const { error } = await createAdminClient()
    .from("cloud_ai_admin_audit_logs")
    .insert({
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

export async function loadCloudAiAdminUserEntitlement(profileId: string) {
  const admin = createAdminClient();
  const entitlementResult = await admin
    .from("cloud_ai_entitlements")
    .select(
      "profile_id,plan_key,status,source,period_starts_at,period_ends_at",
    )
    .eq("profile_id", profileId)
    .maybeSingle<CloudAiAdminUserEntitlement>();
  if (entitlementResult.error || !entitlementResult.data)
    return {
      entitlementResult,
      usageResult: null,
      activeJobsResult: null,
    };

  const [usageResult, activeJobsResult] = await Promise.all([
    admin
      .from("cloud_ai_usage_periods")
      .select(
        "credits_reserved,credits_used,cost_reserved_micros,cost_actual_micros",
      )
      .eq("profile_id", profileId)
      .eq("period_starts_at", entitlementResult.data.period_starts_at)
      .maybeSingle<CloudAiAdminUserUsage>(),
    admin
      .from("cloud_generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("created_by_profile_id", profileId)
      .in("status", ["queued", "running"]),
  ]);
  return { entitlementResult, usageResult, activeJobsResult };
}

export async function updateCloudAiAdminUserEntitlement(input: {
  profileId: string;
  planKey: CloudAiAdminPlanKey;
  durationDays: number;
  now: Date;
}) {
  const admin = createAdminClient();
  const current = await loadCloudAiAdminUserEntitlement(input.profileId);
  const before = current.entitlementResult.data;
  if (current.entitlementResult.error || !before)
    return { status: "not_found" as const, before: null, after: null };
  if (before.source === "stripe")
    return { status: "stripe_managed" as const, before, after: null };
  if (current.usageResult?.error || current.activeJobsResult?.error)
    return { status: "load_failed" as const, before, after: null };
  if ((current.usageResult?.data?.credits_reserved ?? 0) > 0)
    return { status: "credits_reserved" as const, before, after: null };
  if ((current.activeJobsResult?.count ?? 0) > 0)
    return { status: "active_jobs" as const, before, after: null };

  const { data: plan, error: planError } = await admin
    .from("cloud_ai_plans")
    .select("plan_key")
    .eq("plan_key", input.planKey)
    .eq("active", true)
    .maybeSingle<{ plan_key: CloudAiAdminPlanKey }>();
  if (planError || !plan)
    return { status: "plan_unavailable" as const, before, after: null };

  const after = buildCloudAiAdminEntitlementPeriod(input);
  const { data: updated, error } = await admin
    .from("cloud_ai_entitlements")
    .update(after)
    .eq("profile_id", input.profileId)
    .eq("period_starts_at", before.period_starts_at)
    .in("source", ["default", "admin"])
    .select("profile_id")
    .maybeSingle<{ profile_id: string }>();
  if (error || !updated)
    return { status: "update_failed" as const, before, after: null };
  return { status: "updated" as const, before, after };
}

export function loadCloudAiAdminWorkspace(input: {
  checkedAt: string;
  failedSince: string;
}) {
  const admin = createAdminClient();
  return Promise.all([
    admin.from("cloud_ai_settings").select("*").eq("singleton", true).single(),
    admin.from("cloud_ai_plans").select("*").order("plan_key"),
    admin
      .from("cloud_ai_provider_prices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("cloud_ai_daily_costs")
      .select("*")
      .order("usage_date", { ascending: false })
      .limit(14),
    admin
      .from("cloud_generation_jobs")
      .select(
        "id,project_id,page_id,created_by_profile_id,provider_id,model_id,job_type,status,error_code,actual_cost_micros,attempt_count,max_attempts,created_at,updated_at,owner:profiles!cloud_generation_jobs_created_by_profile_id_fkey(display_name),project:cloud_projects!cloud_generation_jobs_project_id_fkey(title)",
      )
      .in("status", ["queued", "failed", "running"])
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("cloud_ai_admin_audit_logs")
      .select(
        "id,action,target_type,target_id,created_at,profiles:actor_profile_id(display_name)",
      )
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("cloud_ai_notifications")
      .select("id,notification_type,severity,title,body,created_at")
      .eq("audience", "admin")
      .order("created_at", { ascending: false })
      .limit(20),
    getCloudGeneralImageSettings(),
    admin
      .from("cloud_generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued"),
    admin
      .from("cloud_generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "running"),
    admin
      .from("cloud_generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    admin
      .from("cloud_generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("updated_at", input.failedSince),
    admin
      .from("cloud_generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "running")
      .lt("lease_expires_at", input.checkedAt),
    admin
      .from("cloud_generation_jobs")
      .select("created_at")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
}

export function loadCloudAiJobForCancel(jobId: string) {
  return createAdminClient()
    .from("cloud_generation_jobs")
    .select("id,status,project_id,created_by_profile_id,job_type,created_at")
    .eq("id", jobId)
    .maybeSingle();
}

export async function cancelCloudAiGenerationJob(jobId: string) {
  const supabase = await createClient();
  return supabase.rpc("cancel_cloud_generation_job", { p_job_id: jobId });
}

export async function updateCloudAiAdminSettings(after: {
  generation_enabled: boolean;
  daily_cost_limit_micros: number;
  warning_percent: number;
}) {
  const admin = createAdminClient();
  const { data: before } = await admin
    .from("cloud_ai_settings")
    .select("generation_enabled,daily_cost_limit_micros,warning_percent")
    .eq("singleton", true)
    .single();
  const { error } = await admin
    .from("cloud_ai_settings")
    .update(after)
    .eq("singleton", true);
  return { before, error };
}

export async function updateCloudAiAdminPlan(
  planKey: string,
  after: {
    monthly_credits: number;
    monthly_cost_limit_micros: number;
    user_requests_per_minute: number;
    project_requests_per_minute: number;
    active: boolean;
    updated_at: string;
  },
) {
  const admin = createAdminClient();
  const { data: before } = await admin
    .from("cloud_ai_plans")
    .select("*")
    .eq("plan_key", planKey)
    .single();
  const { error } = await admin
    .from("cloud_ai_plans")
    .update(after)
    .eq("plan_key", planKey);
  return { before, error };
}

export async function createCloudAiAdminPrice(values: {
  provider_id: string;
  model_id: string;
  kind: "image" | "text";
  job_type:
    | "background"
    | "prop"
    | "effect"
    | "character_base"
    | "story"
    | "storyboard"
    | "speech_bubble";
  pricing_version: string;
  credits: number;
  max_cost_micros: number;
  currency: string;
  active: boolean;
}) {
  return createAdminClient()
    .from("cloud_ai_provider_prices")
    .insert(values)
    .select("id")
    .single<{ id: string }>();
}

export async function setCloudAiAdminPriceActive(
  priceId: string,
  active: boolean,
) {
  const admin = createAdminClient();
  const { data: before } = await admin
    .from("cloud_ai_provider_prices")
    .select("*")
    .eq("id", priceId)
    .single();
  const { error } = await admin
    .from("cloud_ai_provider_prices")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", priceId);
  return { before, error };
}
