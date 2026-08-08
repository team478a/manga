"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { cloudGeneralMonitorBetaEnabled } from "@/lib/cloud-general-monitor";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { reviewGeneralMonitorFeedback } from "@/modules/general-monitor/infrastructure/admin-monitor-repository";

const schema=z.object({feedbackId:z.string().uuid(),status:z.enum(["new","reviewing","resolved"]),adminNote:z.string().trim().max(1000)});
export async function reviewGeneralMonitorFeedbackAction(formData:FormData){
  const {profile}=await requireAdmin();
  if(!cloudGeneralMonitorBetaEnabled()) redirect(encodeURI("/admin/general-monitors?error=モニター機能は停止中です"));
  const parsed=schema.safeParse({feedbackId:formData.get("feedbackId"),status:formData.get("status"),adminNote:formData.get("adminNote")});
  if(!parsed.success) redirect(encodeURI("/admin/general-monitors?error=対応内容を確認してください"));
  const operation=await safelyLoadAdminData("general-monitors/action",()=>reviewGeneralMonitorFeedback({actorProfileId:profile.id,feedbackId:parsed.data.feedbackId,status:parsed.data.status,adminNote:parsed.data.adminNote}));
  if(!operation.ok||operation.value.error) redirect(encodeURI("/admin/general-monitors?error=対応状況を更新できませんでした"));
  revalidatePath("/admin/general-monitors");
  redirect(encodeURI("/admin/general-monitors?message=対応状況を更新しました"));
}
