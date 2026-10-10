"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
const reasonSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/);

export async function reviewExternalSubmissionAction(formData: FormData) {
  await requireAdmin();
  const submissionId = idSchema.parse(formData.get("submissionId"));
  const decision = z.enum(["in_review", "approved", "rejected"]).parse(formData.get("decision"));
  const rawReason = String(formData.get("reasonCode") ?? "").trim();
  const reasonCode = rawReason ? reasonSchema.parse(rawReason) : null;
  if (decision === "rejected" && !reasonCode)
    redirect(`/admin/external-submissions?error=${encodeURIComponent("差し戻し理由コードが必要です")}`);
  const supabase = await createClient();
  const result = await supabase.rpc("review_external_work_submission", {
    p_submission_id: submissionId,
    p_decision: decision,
    p_reason_code: reasonCode,
  });
  if (result.error)
    redirect(`/admin/external-submissions?error=${encodeURIComponent("審査状態を更新できませんでした")}`);
  revalidatePath("/admin/external-submissions");
}

export async function stopExternalListingAction(formData: FormData) {
  await requireAdmin();
  const submissionId = idSchema.parse(formData.get("submissionId"));
  const reasonCode = reasonSchema.safeParse(String(formData.get("reasonCode") ?? "").trim());
  if (!reasonCode.success)
    redirect(`/admin/external-submissions?error=${encodeURIComponent("停止理由コードを入力してください")}`);
  const supabase = await createClient();
  const result = await supabase.rpc("stop_external_marketplace_listing", {
    p_submission_id: submissionId,
    p_reason_code: reasonCode.data,
  });
  if (result.error)
    redirect(`/admin/external-submissions?error=${encodeURIComponent("公開停止に失敗しました")}`);
  revalidatePath("/admin/external-submissions");
}
