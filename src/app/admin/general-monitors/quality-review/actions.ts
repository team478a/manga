"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { monitorQualityReviewEnabled } from "@/lib/monitor-quality-review";
import { monitorQualityReviewSlotSchema } from "@/modules/manga-quality/domain/monitor-quality-review";
import {
  assignMonitorQualityReview,
  setMonitorQualityReviewBatchLifecycle,
} from "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";

const schema = z.object({
  batchId: z.string().uuid(),
  reviewerProfileId: z.string().uuid(),
  reviewerSlot: monitorQualityReviewSlotSchema,
});

const lifecycleSchema = z.object({
  batchId: z.string().uuid(),
  transition: z.enum(["activate", "pause", "resume"]),
});

function describeBatchLifecycleError(message: string) {
  const descriptions: Record<string, string> = {
    monitor_quality_review_batch_not_found: "Batchを確認できませんでした",
    monitor_quality_review_batch_state_invalid: "Batchの現在状態が変わったため、再読み込みしてください",
    monitor_quality_review_review_scope_invalid: "このBatchは対象の品質確認範囲ではありません",
    monitor_quality_review_source_package_invalid: "元packageの照合情報が不正です",
    monitor_quality_review_rights_review_invalid: "人間による権利確認情報を確認してください",
    monitor_quality_review_schedule_invalid: "Batchの開始・終了期間を確認してください",
    monitor_quality_review_case_count_invalid: "画像件数がPilot契約の28枚と一致しません",
    monitor_quality_review_draft_assignment_exists: "Draft Batchに既存の担当割当があるため有効化できません",
    monitor_quality_review_batch_update_conflict: "別の操作でBatch状態が変わりました。再読み込みしてください",
  };
  return descriptions[message] ?? "Batchの状態を変更できませんでした";
}

export async function setMonitorQualityReviewBatchLifecycleAction(formData: FormData) {
  await requireAdmin();
  const parsed = lifecycleSchema.safeParse({
    batchId: formData.get("batchId"),
    transition: formData.get("transition"),
  });
  if (!parsed.success)
    redirect(encodeURI("/admin/general-monitors/quality-review?error=Batch操作を確認してください"));
  const result = await setMonitorQualityReviewBatchLifecycle(parsed.data);
  if (result.error)
    redirect(encodeURI(`/admin/general-monitors/quality-review?error=${describeBatchLifecycleError(result.error.message)}`));
  revalidatePath("/admin/general-monitors/quality-review");
  const message = parsed.data.transition === "pause"
    ? "Batchを停止しました"
    : parsed.data.transition === "resume"
      ? "Batchを再開しました"
      : "Batchを有効化しました";
  redirect(encodeURI(`/admin/general-monitors/quality-review?message=${message}`));
}

export async function assignMonitorQualityReviewAction(formData: FormData) {
  const { profile } = await requireAdmin();
  if (!monitorQualityReviewEnabled())
    redirect(encodeURI("/admin/general-monitors/quality-review?error=品質確認機能は停止中です"));
  const parsed = schema.safeParse({
    batchId: formData.get("batchId"),
    reviewerProfileId: formData.get("reviewerProfileId"),
    reviewerSlot: formData.get("reviewerSlot"),
  });
  if (!parsed.success)
    redirect(encodeURI("/admin/general-monitors/quality-review?error=割当内容を確認してください"));
  const result = await assignMonitorQualityReview({ ...parsed.data, actorProfileId: profile.id });
  if (result.error) {
    const message = result.error.message === "monitor_quality_review_slot_outside_target"
      ? "この枠はBatchの目標確認者数を超えています"
      : result.error.message === "monitor_quality_review_assignment_unavailable"
        ? "Batchまたはモニターが利用期間外です。開始日時・終了日時を確認してください"
        : "同じ枠または同じ利用者がすでに割り当てられています";
    redirect(encodeURI(`/admin/general-monitors/quality-review?error=${message}`));
  }
  revalidatePath("/admin/general-monitors/quality-review");
  redirect(encodeURI("/admin/general-monitors/quality-review?message=確認担当を割り当てました"));
}
