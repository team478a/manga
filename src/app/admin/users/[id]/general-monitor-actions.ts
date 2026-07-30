"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { cloudGeneralMonitorBetaEnabled } from "@/lib/cloud-general-monitor";
import { createAdminClient } from "@/lib/supabase/admin";

const activationSchema = z.object({
  profileId: z.string().uuid(),
  cohort: z.string().trim().min(1).max(80),
  aiRequestLimit: z.coerce.number().int().min(1).max(200),
  expiresAt: z.string().refine(
    (value) => Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now(),
  ),
  adminNote: z.string().trim().max(500),
});
const stopSchema = z.object({
  profileId: z.string().uuid(),
  status: z.enum(["paused", "completed", "revoked"]),
  adminNote: z.string().trim().min(1).max(500),
});
const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
};

export async function activateCloudGeneralMonitorAction(
  profileId: string,
  formData: FormData,
) {
  const { profile: actor } = await requireAdmin();
  if (!cloudGeneralMonitorBetaEnabled())
    redirect(`/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("一般向けモニターは現在停止中です")}`);
  const parsed = activationSchema.safeParse({
    profileId,
    cohort: value(formData, "cohort"),
    aiRequestLimit: value(formData, "aiRequestLimit"),
    expiresAt: value(formData, "expiresAt"),
    adminNote: value(formData, "adminNote"),
  });
  if (!parsed.success)
    redirect(`/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("期間・AI上限・招待情報を確認してください")}`);
  const { error } = await createAdminClient().rpc(
    "activate_cloud_general_monitor",
    {
      p_actor_profile_id: actor.id,
      p_target_profile_id: parsed.data.profileId,
      p_expires_at: new Date(parsed.data.expiresAt).toISOString(),
      p_cohort: parsed.data.cohort,
      p_ai_request_limit: parsed.data.aiRequestLimit,
      p_admin_note: parsed.data.adminNote,
    },
  );
  if (error)
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("一般向けモニターを開始できませんでした")}`);
  revalidatePath(`/admin/users/${parsed.data.profileId}`);
  revalidatePath("/admin/general-monitors");
  redirect(`/admin/users/${parsed.data.profileId}?message=${encodeURIComponent("一般向けモニターへ招待しました")}`);
}

export async function stopCloudGeneralMonitorAction(
  profileId: string,
  formData: FormData,
) {
  const { profile: actor } = await requireAdmin();
  if (!cloudGeneralMonitorBetaEnabled())
    redirect(`/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("一般向けモニターは現在停止中です")}`);
  const parsed = stopSchema.safeParse({
    profileId,
    status: value(formData, "status"),
    adminNote: value(formData, "adminNote"),
  });
  if (!parsed.success)
    redirect(`/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("停止理由を入力してください")}`);
  const { error } = await createAdminClient().rpc("stop_cloud_general_monitor", {
    p_actor_profile_id: actor.id,
    p_target_profile_id: parsed.data.profileId,
    p_status: parsed.data.status,
    p_admin_note: parsed.data.adminNote,
  });
  if (error)
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("一般向けモニターを停止できませんでした")}`);
  revalidatePath(`/admin/users/${parsed.data.profileId}`);
  revalidatePath("/admin/general-monitors");
  redirect(`/admin/users/${parsed.data.profileId}?message=${encodeURIComponent("一般向けモニターを停止しました")}`);
}
