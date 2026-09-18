"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { actionFeedbackTarget } from "@/lib/action-contracts";
import { requireAdmin } from "@/lib/auth";
import { saveAdminGenerationQualityReview } from "@/modules/manga-quality/infrastructure/admin-generation-quality-repository";

const reviewSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["approved", "needs_review", "quality_issue"]),
  note: z.string().trim().max(1000),
});

export async function reviewAdminGenerationQualityAction(formData: FormData) {
  await requireAdmin();
  const parsed = reviewSchema.safeParse({
    jobId: formData.get("jobId"),
    status: formData.get("status"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    redirect(
      actionFeedbackTarget(
        "/admin/generation-quality",
        "error",
        "判定内容を確認してください",
      ),
    );
  }
  const operation = await safelyLoadAdminData("generation-quality/action", () =>
    saveAdminGenerationQualityReview(parsed.data),
  );
  if (!operation.ok || operation.value.error) {
    redirect(
      actionFeedbackTarget(
        "/admin/generation-quality",
        "error",
        "品質判定を保存できませんでした",
      ),
    );
  }
  revalidatePath("/admin/generation-quality");
  redirect(
    actionFeedbackTarget(
      "/admin/generation-quality",
      "message",
      "品質判定を保存しました",
    ),
  );
}
