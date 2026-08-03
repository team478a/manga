"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { cloudGeneralMonitorBetaEnabled } from "@/lib/cloud-general-monitor";
import { createAdminClient } from "@/lib/supabase/admin";
import { safelyLoadAdminData } from "@/lib/admin-resilience";

const schema=z.object({feedbackId:z.string().uuid(),status:z.enum(["new","reviewing","resolved"]),adminNote:z.string().trim().max(1000)});
export async function reviewGeneralMonitorFeedbackAction(formData:FormData){
  const {profile}=await requireAdmin();
  if(!cloudGeneralMonitorBetaEnabled()) redirect("/admin/general-monitors?error=モニター機能は停止中です");
  const parsed=schema.safeParse({feedbackId:formData.get("feedbackId"),status:formData.get("status"),adminNote:formData.get("adminNote")});
  if(!parsed.success) redirect("/admin/general-monitors?error=対応内容を確認してください");
  const operation=await safelyLoadAdminData("general-monitors/action",async()=>createAdminClient().rpc("review_cloud_general_monitor_feedback",{p_actor_profile_id:profile.id,p_feedback_id:parsed.data.feedbackId,p_status:parsed.data.status,p_admin_note:parsed.data.adminNote}));
  if(!operation.ok||operation.value.error) redirect("/admin/general-monitors?error=対応状況を更新できませんでした");
  revalidatePath("/admin/general-monitors");
  redirect("/admin/general-monitors?message=対応状況を更新しました");
}
