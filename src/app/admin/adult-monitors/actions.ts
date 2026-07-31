"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  feedbackId: z.string().uuid(),
  status: z.enum(["new", "reviewing", "resolved"]),
  adminNote: z.string().trim().max(1000),
});

export async function reviewAdultMonitorFeedbackAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const parsed = schema.safeParse({
    feedbackId: formData.get("feedbackId"),
    status: formData.get("status"),
    adminNote: formData.get("adminNote"),
  });
  if (!parsed.success)
    redirect("/admin/adult-monitors?error=対応内容を確認してください");
  const { error } = await createAdminClient().rpc(
    "review_cloud_adult_monitor_feedback",
    {
      p_actor_profile_id: profile.id,
      p_feedback_id: parsed.data.feedbackId,
      p_status: parsed.data.status,
      p_admin_note: parsed.data.adminNote,
    },
  );
  if (error)
    redirect("/admin/adult-monitors?error=対応状況を更新できませんでした");
  revalidatePath("/admin/adult-monitors");
  redirect("/admin/adult-monitors?message=対応状況を更新しました");
}
