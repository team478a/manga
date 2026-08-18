"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { monitorQualityReviewEnabled } from "@/lib/monitor-quality-review";
import { assignMonitorQualityReview } from "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";

const schema = z.object({
  batchId: z.string().uuid(),
  reviewerProfileId: z.string().uuid(),
  reviewerSlot: z.enum(["reviewer_a", "reviewer_b"]),
});

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
  if (result.error)
    redirect(encodeURI("/admin/general-monitors/quality-review?error=同じ枠または同じ利用者がすでに割り当てられています"));
  revalidatePath("/admin/general-monitors/quality-review");
  redirect(encodeURI("/admin/general-monitors/quality-review?message=確認担当を割り当てました"));
}
