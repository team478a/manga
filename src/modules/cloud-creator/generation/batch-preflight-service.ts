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
import { cloudStoryboardResultSchema } from "@/lib/cloud-storyboard";
import { cloudStoryScenarioResultSchema } from "@/lib/cloud-scenario";

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

async function loadPageStructure(
  supabase: Awaited<ReturnType<typeof cloudCreatorContext>>["supabase"],
  projectId: string,
) {
  const result = await supabase.from("cloud_pages")
    .select("id,page_number,revision,cloud_canvas_snapshots(canvas,revision)")
    .eq("project_id", projectId).is("deleted_at", null);
  if (result.error)
    throw new DomainError("INTERNAL_ERROR", "一括生成対象を確認できませんでした。", { cause: result.error });
  const pages = result.data ?? [];
  return {
    pagePanelCounts: Object.fromEntries(pages.map((page) => {
      const snapshots = Array.isArray(page.cloud_canvas_snapshots) ? page.cloud_canvas_snapshots : [];
      const current = snapshots.find((snapshot) => snapshot.revision === page.revision);
      if (!current) return [page.id, null];
      const parsed = pageCanvasSchema.safeParse(current.canvas);
      return [page.id, parsed.success ? parsed.data.panels.length : null];
    })) as Record<string, number | null>,
    pageNumbers: Object.fromEntries(
      pages.map((page) => [page.id, page.page_number]),
    ) as Record<string, number>,
  };
}

function hasCharacterVisualDetails(version: {
  appearance_age: string;
  body_build: string;
  hair: string;
  costume: string;
  color_palette: string;
  immutable_traits: string[];
  prompt: string;
}) {
  return Boolean(
    version.appearance_age.trim() &&
    version.body_build.trim() &&
    version.hair.trim() &&
    version.costume.trim() &&
    version.immutable_traits.length,
  );
}

async function loadVisualReadiness(
  supabase: Awaited<ReturnType<typeof cloudCreatorContext>>["supabase"],
  projectId: string,
  pageNumbers: Record<string, number>,
) {
  const [materialization, characterProfiles, styleBible] = await Promise.all([
    supabase.from("cloud_story_storyboard_projects")
      .select("storyboard_version_id")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase.from("cloud_character_profiles")
      .select("id,name,current_version")
      .eq("project_id", projectId)
      .is("deleted_at", null),
    supabase.from("cloud_style_bibles")
      .select("id,current_version")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);
  const loadError = materialization.error ?? characterProfiles.error ?? styleBible.error;
  if (loadError)
    throw new DomainError("INTERNAL_ERROR", "人物・画風の生成準備を確認できませんでした。", {
      cause: loadError,
    });
  const profiles = characterProfiles.data ?? [];
  if (!materialization.data)
    return {
      visualReadinessAvailable: false,
      styleBibleConfigured: false,
      configuredCharacterNames: [] as string[],
      pageCharacterNames: {} as Record<string, string[]>,
    };

  const [storyboard, characterVersions, styleVersion] = await Promise.all([
    supabase.from("cloud_story_storyboard_versions")
      .select("result,scenario_version_id")
      .eq("id", materialization.data.storyboard_version_id)
      .maybeSingle(),
    profiles.length
      ? supabase.from("cloud_character_profile_versions")
        .select("profile_id,version_number,appearance_age,body_build,hair,costume,color_palette,immutable_traits,prompt")
        .in("profile_id", profiles.map((profile) => profile.id))
      : Promise.resolve({ data: [], error: null }),
    styleBible.data
      ? supabase.from("cloud_style_bible_versions")
        .select("bible_id,version_number,art_style,linework,shading,background_detail,composition_rules")
        .eq("bible_id", styleBible.data.id)
        .eq("version_number", styleBible.data.current_version)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const detailError = storyboard.error ?? characterVersions.error ?? styleVersion.error;
  if (detailError || !storyboard.data)
    throw new DomainError("INTERNAL_ERROR", "人物・画風の生成準備を確認できませんでした。", {
      cause: detailError,
    });
  const scenario = await supabase.from("cloud_story_scenario_versions")
    .select("result")
    .eq("id", storyboard.data.scenario_version_id)
    .maybeSingle();
  if (scenario.error || !scenario.data)
    throw new DomainError("INTERNAL_ERROR", "人物・画風の生成準備を確認できませんでした。", {
      cause: scenario.error,
    });
  const parsedStoryboard = cloudStoryboardResultSchema.safeParse(storyboard.data.result);
  const parsedScenario = cloudStoryScenarioResultSchema.safeParse(scenario.data.result);
  if (!parsedStoryboard.success || !parsedScenario.success)
    return {
      visualReadinessAvailable: false,
      styleBibleConfigured: false,
      configuredCharacterNames: [] as string[],
      pageCharacterNames: {} as Record<string, string[]>,
    };
  const versions = characterVersions.data ?? [];
  const configuredCharacterNames = profiles.flatMap((profile) => {
    const current = versions.find(
      (version) =>
        version.profile_id === profile.id &&
        version.version_number === profile.current_version,
    );
    return current && hasCharacterVisualDetails(current) ? [profile.name] : [];
  });
  const style = styleVersion.data;
  const styleBibleConfigured = Boolean(
    style && (
      style.art_style.trim() &&
      style.linework.trim() &&
      style.shading.trim() &&
      style.background_detail.trim() &&
      style.composition_rules.trim()
    ),
  );
  const storyboardByPage = new Map(
    parsedStoryboard.data.pages.map((page) => [page.pageNumber, page]),
  );
  const normalizeName = (value: string) =>
    value.normalize("NFKC").toLocaleLowerCase();
  const scenarioCharacterNames = new Set(
    parsedScenario.data.characters.map((character) => normalizeName(character.name)),
  );
  const pageCharacterNames = Object.fromEntries(
    Object.entries(pageNumbers).map(([pageId, pageNumber]) => [
      pageId,
      Array.from(new Set(
        (storyboardByPage.get(pageNumber)?.panels ?? [])
          .flatMap((panel) => panel.characters)
          .filter((name) => scenarioCharacterNames.has(normalizeName(name))),
      )),
    ]),
  );
  return {
    visualReadinessAvailable: true,
    styleBibleConfigured,
    configuredCharacterNames,
    pageCharacterNames,
  };
}

export async function getCloudGenerationBatchPreflight(
  projectId: string,
): Promise<GenerationBatchPreflightContext> {
  const { supabase, profile } = await cloudCreatorContext();
  const [quotaResult, projectUsageResult, imageSettings, monitor, global, pageStructure] = await Promise.all([
    supabase.rpc("get_my_cloud_ai_quota"),
    supabase.rpc("get_cloud_project_resource_usage", { p_project_id: projectId }),
    getCloudGeneralImageSettings(),
    getCloudGeneralMonitorEnrollment(profile.id),
    loadGlobalCapacity(),
    loadPageStructure(supabase, projectId),
  ]);
  if (quotaResult.error || projectUsageResult.error)
    throw new DomainError("INTERNAL_ERROR", "一括生成の利用枠を確認できませんでした。", {
      cause: quotaResult.error ?? projectUsageResult.error,
    });
  const quota = ((quotaResult.data ?? [])[0] ?? null) as CloudAiQuota | null;
  const projectUsage = ((projectUsageResult.data ?? [])[0] ?? null) as CloudProjectResourceUsage | null;
  if (!quota || !projectUsage)
    throw new DomainError("INTERNAL_ERROR", "一括生成の利用枠を確認できませんでした。");
  const visualReadiness = await loadVisualReadiness(
    supabase,
    projectId,
    pageStructure.pageNumbers,
  );

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
    pagePanelCounts: pageStructure.pagePanelCounts,
    ...visualReadiness,
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
