import { DomainError, ValidationError } from "@/lib/domain-errors";
import type { CloudProjectBudgetInput, CloudProjectResourceUsage } from "@/lib/cloud-project-budget";
import { cloudCreatorContext } from "@/modules/cloud-creator/auth-context";

export async function getCloudProjectResourceUsage(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("get_cloud_project_resource_usage", { p_project_id: projectId });
  if (error) {
    if (error.message?.includes("get_cloud_project_resource_usage")) return { available: false as const, usage: null };
    throw new DomainError("INTERNAL_ERROR", "作品の利用状況を読み込めませんでした。", { cause: error });
  }
  return { available: true as const, usage: ((data ?? [])[0] ?? null) as CloudProjectResourceUsage | null };
}
export async function saveCloudProjectBudget(input: CloudProjectBudgetInput) {
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc("save_cloud_project_resource_budget", {
    p_project_id: input.projectId,
    p_monthly_credit_limit: input.monthlyCreditLimit,
    p_monthly_cost_limit_micros: input.monthlyCostLimitMicros,
    p_storage_limit_bytes: input.storageLimitBytes,
    p_warning_percent: input.warningPercent,
    p_generation_enabled: input.generationEnabled,
  });
  if (error) throw new ValidationError("作品の生成上限を保存できませんでした。");
}
