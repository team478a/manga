import {
  ContentRejectedError,
  DomainError,
  PermissionDeniedError,
  ProviderUnavailableError,
  QuotaExceededError,
  RateLimitedError,
  ValidationError,
} from "../../../lib/domain-errors.ts";

type GenerationDatabaseError = {
  message?: string;
};

export function mapCloudGenerationEnqueueError(
  error: GenerationDatabaseError | null | undefined,
) {
  const signal = error?.message?.split(":", 1)[0];
  switch (signal) {
    case "cloud_credit_quota_exceeded":
      return new QuotaExceededError(
        "今月のCloud AI生成creditを使い切りました。",
      );
    case "cloud_cost_quota_exceeded":
      return new QuotaExceededError("今月のCloud AI費用上限に達しました。");
    case "cloud_daily_budget_exceeded":
      return new QuotaExceededError(
        "本日のCloud AI運用予算に達したため停止中です。",
      );
    case "cloud_generation_rate_limited":
      return new RateLimitedError(
        "Cloud AI要求が集中しています。1分後に再試行してください。",
      );
    case "cloud_entitlement_inactive":
    case "cloud_plan_unavailable":
      return new PermissionDeniedError(
        "Cloud AIプランが有効ではありません。",
      );
    case "cloud_generation_disabled":
    case "cloud_generation_price_unavailable":
      return new ProviderUnavailableError(
        "Cloud AI生成は現在停止中です。",
      );
    case "cloud_generation_input_rejected":
      return new ValidationError("Cloud AI生成内容が不正です。");
    case "cloud_project_not_editable":
    case "general_cloud_project_required":
    case "cloud_page_not_found":
      return new PermissionDeniedError(
        "この作品では生成できません。",
      );
    default:
      return new DomainError(
        "INTERNAL_ERROR",
        "Cloud AI Jobを登録できませんでした。",
        { cause: error },
      );
  }
}

export function cloudModerationRejectedError(reasons: string[]) {
  const reason = reasons.join(", ") || "classification_required";
  return new ContentRejectedError(
    `Cloud AI送信前確認で拒否されました: ${reason}`,
  );
}
