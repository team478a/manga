import {
  ContentRejectedError,
  DomainError,
  PermissionDeniedError,
  ProviderUnavailableError,
  QuotaExceededError,
  RateLimitedError,
  RevisionConflictError,
  ValidationError,
} from "../../../lib/domain-errors.ts";

type GenerationDatabaseError = {
  code?: string;
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
    case "cloud_project_credit_limit_exceeded":
      return new QuotaExceededError("この作品の月間生成上限に達しました。");
    case "cloud_project_cost_limit_exceeded":
      return new QuotaExceededError("この作品の月間費用上限に達しました。");
    case "cloud_project_storage_limit_exceeded":
      return new QuotaExceededError("この作品の保存容量上限に達しました。");
    case "cloud_project_generation_disabled":
      return new ProviderUnavailableError("この作品のAI生成は停止中です。");
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

export function mapCloudGenerationBatchRegistrationError(
  error: GenerationDatabaseError | null | undefined,
) {
  const signal = error?.message?.split(":", 1)[0];
  switch (signal) {
    case "cloud_batch_targets_access_denied":
      return new PermissionDeniedError(
        "この作品では一括生成を開始できません。",
      );
    case "cloud_batch_targets_count_invalid":
      return new ValidationError("一括生成するコマ数を確認してください。");
    case "cloud_batch_targets_page_revision_invalid":
      return new RevisionConflictError(
        "ページ内容が準備中に更新されました。再読込してから開始してください。",
      );
    case "cloud_batch_targets_pricing_invalid":
      return new ProviderUnavailableError(
        "一括生成のProvider・model・料金設定が更新されました。再確認してください。",
      );
    case "cloud_batch_targets_panel_invalid":
      return new RevisionConflictError(
        "コマ構成が準備中に更新されました。再読込してから開始してください。",
      );
    case "cloud_batch_targets_payload_invalid":
      return new ValidationError("一括生成条件を安全に固定できませんでした。");
    case "cloud_batch_targets_uniqueness_invalid":
      return new ValidationError(
        "一括生成対象に重複があります。ページを再選択してください。",
      );
    case "cloud_batch_targets_insert_invalid":
      return new DomainError(
        "INTERNAL_ERROR",
        "一括生成targetをすべて永続登録できませんでした。",
        { cause: error },
      );
    case "cloud_batch_targets_invalid":
      return new DomainError(
        "INTERNAL_ERROR",
        "一括生成targetを永続登録できませんでした。",
        { cause: error },
      );
    default:
      if (
        error?.code === "PGRST202" ||
        error?.message?.startsWith("Could not find the function")
      ) {
        return new ProviderUnavailableError(
          "一括生成の登録機能を読み込めませんでした。時間をおいて再度お試しください。",
        );
      }
      return new DomainError(
        "INTERNAL_ERROR",
        "一括生成targetを永続登録できませんでした。",
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
