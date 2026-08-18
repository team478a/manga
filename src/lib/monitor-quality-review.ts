import { PermissionDeniedError } from "@/lib/domain-errors";
import { featureFlagEnabled } from "@/lib/feature-flags";

export function monitorQualityReviewEnabled() {
  return featureFlagEnabled("MANGAI_MONITOR_QUALITY_REVIEW_ENABLED");
}

export function assertMonitorQualityReviewEnabled() {
  if (!monitorQualityReviewEnabled())
    throw new PermissionDeniedError("画像品質の確認は現在準備中です。");
}
