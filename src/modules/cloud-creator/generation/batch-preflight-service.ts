import { pageCanvasSchema } from "@mangai/canvas-core";
import { getCloudGeneralImageSettings, cloudGeneralImagePricingVersion } from "@/lib/cloud-general-image-settings";
import { getCloudGeneralMonitorEnrollment, isCloudGeneralMonitorActive } from "@/lib/cloud-general-monitor";
import { createAdminClient } from "@/lib/supabase/admin";
import { DomainError, ValidationError } from "@/lib/domain-errors";
import {
  estimateGenerationBatch,
  remainingGenerationCapacity,
  type GenerationBatchPreflightContext,
} from "../../manga/domain/generation-batch-preflight";
import type { CloudAiQuota } from "../contracts/types";
import { cloudCreatorContext } from "../auth-context";
import type { CloudProjectResourceUsage } from "@/lib/cloud-project-budget";

type PriceRow = {
  credits: number;
  max_cost_micros: number;
  currency: string;
  pricing_version: string;
};

async function loadGlobalCapacity() {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const [settings, usage] = await Promise.all([
    admin.from("cloud_ai_settings")
      .select("generation_enabled,daily_cost_limit_micros")
      .eq("singleton", true).maybeSingle(),
    admin.from("cloud_ai_daily_costs")
      .select("cost_reserved_micros,cost_actual_micros")
      .eq("usage_date", today).maybeSingle(),
  ]);
  if (settings.error || !settings.data || usage.error)
    throw new DomainError("INTERNAL_ERROR", "Cloud AI全体利用枠を確認できませんでした。", {
      cause: settings.error ?? usage.error,
    });
  return {
    enabled: settings.data.generation_enabled,
    costRemaining: remainingGenerationCapacity({
      limit: settings.data.daily_cost_limit_micros,
      reserved: usage.data?.cost_reserved_micros ?? 0,
      used: usage.data?.cost_actual_micros ?? 0,
    }),
  };
}

async function loadPagePanelCounts(
  supabase: Awaited<ReturnType<typeof cloudCreatorContext>>["supabase"],
  projectId: string,
) {
  const result = await supabase.from("cloud_pages")
    .select("id,revision,cloud_canvas_snapshots(canvas,revision)")
    .eq("project_id", projectId).is("deleted_at", null);
  if (result.error)
    throw new DomainError("INTERNAL_ERROR", "一括生成対象を確認できませんでした。", { cause: result.error });
  return Object.fromEntries((result.data ?? []).map((page) => {
    const snapshots = Array.isArray(page.cloud_canvas_snapshots) ? page.cloud_canvas_snapshots : [];
    const current = snapshots.find((snapshot) => snapshot.revision === page.revision);
    if (!current) return [page.id, null];
    const parsed = pageCanvasSchema.safeParse(current.canvas);
    return [page.id, parsed.success ? parsed.data.panels.length : null];
  })) as Record<string, number | null>;
}

export async function getCloudGenerationBatchPreflight(
  projectId: string,
): Promise<GenerationBatchPreflightContext> {
  const { supabase, profile } = await cloudCreatorContext();
  const [quotaResult, projectUsageResult, imageSettings, monitor, global, pagePanelCounts] = await Promise.all([
    supabase.rpc("get_my_cloud_ai_quota"),
    supabase.rpc("get_cloud_project_resource_usage", { p_project_id: projectId }),
    getCloudGeneralImageSettings(),
    getCloudGeneralMonitorEnrollment(profile.id),
    loadGlobalCapacity(),
    loadPagePanelCounts(supabase, projectId),
  ]);
  if (quotaResult.error || projectUsageResult.error)
    throw new DomainError("INTERNAL_ERROR", "一括生成の利用枠を確認できませんでした。", {
      cause: quotaResult.error ?? projectUsageResult.error,
    });
  const quota = ((quotaResult.data ?? [])[0] ?? null) as CloudAiQuota | null;
  const projectUsage = ((projectUsageResult.data ?? [])[0] ?? null) as CloudProjectResourceUsage | null;
  if (!quota || !projectUsage)
    throw new DomainError("INTERNAL_ERROR", "一括生成の利用枠を確認できませんでした。");

  const planResult = await supabase.from("cloud_ai_plans")
    .select("user_requests_per_minute,project_requests_per_minute")
    .eq("plan_key", quota.plan_key).eq("active", true).maybeSingle();
  if (planResult.error || !planResult.data)
    throw new DomainError("INTERNAL_ERROR", "Cloud AI planを確認できませんでした。", { cause: planResult.error });

  let price: PriceRow | null = null;
  if (imageSettings?.enabled && imageSettings.configured) {
    const pricingVersion = cloudGeneralImagePricingVersion(imageSettings.model);
    const priceResult = await supabase.from("cloud_ai_provider_prices")
      .select("credits,max_cost_micros,currency,pricing_version")
      .eq("provider_id", "black-forest-labs")
      .eq("model_id", imageSettings.model)
      .eq("kind", "image")
      .eq("job_type", "background")
      .eq("pricing_version", pricingVersion)
      .eq("active", true).maybeSingle<PriceRow>();
    if (priceResult.error)
      throw new DomainError("INTERNAL_ERROR", "画像生成料金を確認できませんでした。", { cause: priceResult.error });
    price = priceResult.data;
  }

  return {
    available: Boolean(price),
    providerEnabled: Boolean(imageSettings?.enabled && imageSettings.configured),
    modelId: imageSettings?.model ?? null,
    pricingVersion: price?.pricing_version ?? (imageSettings ? cloudGeneralImagePricingVersion(imageSettings.model) : null),
    currency: price?.currency ?? quota.currency,
    creditsPerJob: price?.credits ?? null,
    maxCostMicrosPerJob: price?.max_cost_micros ?? null,
    planKey: quota.plan_key,
    entitlementStatus: quota.entitlement_status,
    planGenerationEnabled: quota.generation_enabled,
    planCreditsRemaining: remainingGenerationCapacity({ limit: quota.credits_limit, reserved: quota.credits_reserved, used: quota.credits_used }),
    planCostMicrosRemaining: remainingGenerationCapacity({ limit: quota.cost_limit_micros, reserved: quota.cost_reserved_micros, used: quota.cost_actual_micros }),
    projectGenerationEnabled: projectUsage.generation_enabled,
    projectCreditsRemaining: remainingGenerationCapacity({ limit: projectUsage.monthly_credit_limit, reserved: projectUsage.credits_reserved, used: projectUsage.credits_used }),
    projectCostMicrosRemaining: remainingGenerationCapacity({ limit: projectUsage.monthly_cost_limit_micros, reserved: projectUsage.cost_reserved_micros, used: projectUsage.cost_actual_micros }),
    globalGenerationEnabled: global.enabled,
    globalCostMicrosRemaining: global.costRemaining,
    monitorActive: isCloudGeneralMonitorActive(monitor),
    monitorRequestsRemaining: monitor ? Math.max(0, monitor.ai_request_limit - monitor.ai_requests_used) : null,
    userRequestsPerMinute: planResult.data.user_requests_per_minute,
    projectRequestsPerMinute: planResult.data.project_requests_per_minute,
    pagePanelCounts,
    schedulerJobsPerRun: 3,
    schedulerIntervalMinutes: 5,
  };
}

export async function assertCloudGenerationBatchPreflight(
  projectId: string,
  pageIds: string[],
) {
  const context = await getCloudGenerationBatchPreflight(projectId);
  const estimate = estimateGenerationBatch(context, pageIds);
  if (!estimate.canStart)
    throw new ValidationError(estimate.blockers[0] ?? "一括生成を開始できませんでした。");
  return estimate;
}
