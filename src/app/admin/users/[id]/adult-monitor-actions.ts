"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { cloudAdultMonitorBetaEnabled } from "@/lib/cloud-adult-monitor";
import {
  cloudGeneralMonitorInviteEmailConfigured,
  sendCloudAdultMonitorInviteEmail,
} from "@/lib/cloud-general-monitor-email";
import { createAdminClient } from "@/lib/supabase/admin";

const activationSchema = z.object({
  profileId: z.string().uuid(),
  source: z.enum(["purchase", "legacy_purchase", "admin_grant", "campaign"]),
  cohort: z.string().trim().min(1).max(80),
  aiRequestLimit: z.coerce.number().int().min(1).max(100),
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

async function getInviteRecipient(profileId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles")
    .select("user_id,display_name").eq("id", profileId)
    .maybeSingle<{ user_id: string; display_name: string }>();
  if (!profile) return null;
  const { data } = await admin.auth.admin.getUserById(profile.user_id);
  return data.user?.email
    ? { email: data.user.email, name: profile.display_name || "" }
    : null;
}

export async function activateCloudAdultMonitorAction(
  profileId: string,
  formData: FormData,
) {
  const { profile: actor } = await requireAdmin();
  if (!cloudAdultMonitorBetaEnabled())
    redirect(`/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("成人向けモニターは現在停止中です")}`);
  const parsed = activationSchema.safeParse({
    profileId,
    source: value(formData, "source"),
    cohort: value(formData, "cohort"),
    aiRequestLimit: value(formData, "aiRequestLimit"),
    expiresAt: value(formData, "expiresAt"),
    adminNote: value(formData, "adminNote"),
  });
  if (!parsed.success)
    redirect(
      `/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("モニター期間・利用上限・許可理由を確認してください")}`,
    );
  const { error } = await createAdminClient().rpc(
    "activate_cloud_adult_monitor",
    {
      p_actor_profile_id: actor.id,
      p_target_profile_id: parsed.data.profileId,
      p_source: parsed.data.source,
      p_expires_at: new Date(parsed.data.expiresAt).toISOString(),
      p_cohort: parsed.data.cohort,
      p_ai_request_limit: parsed.data.aiRequestLimit,
      p_admin_note: parsed.data.adminNote,
    },
  );
  if (error)
    redirect(
      `/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("限定モニターを開始できませんでした")}`,
    );
  const recipient = await getInviteRecipient(parsed.data.profileId);
  if (!recipient || !(await cloudGeneralMonitorInviteEmailConfigured()))
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("招待登録は完了しましたが、送信先またはメール設定を確認してください")}`);
  try {
    await sendCloudAdultMonitorInviteEmail({
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      expiresAt: new Date(parsed.data.expiresAt).toISOString(),
      aiRequestLimit: parsed.data.aiRequestLimit,
    });
  } catch {
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("招待登録は完了しましたが、メールを送信できませんでした。設定を確認して再送してください")}`);
  }
  revalidatePath(`/admin/users/${parsed.data.profileId}`);
  revalidatePath("/admin/adult-monitors");
  redirect(
    `/admin/users/${parsed.data.profileId}?message=${encodeURIComponent("成人向け全工程を一括許可し、招待メールを送信しました")}`,
  );
}

export async function resendCloudAdultMonitorInviteAction(profileId: string) {
  await requireAdmin();
  const parsed = z.string().uuid().safeParse(profileId);
  if (!parsed.success) redirect("/admin/users?error=ユーザー情報を確認してください");
  const admin = createAdminClient();
  const [{ data: enrollment }, recipient] = await Promise.all([
    admin.from("cloud_adult_monitor_enrollments")
      .select("status,expires_at,ai_request_limit")
      .eq("profile_id", parsed.data)
      .maybeSingle<{ status: string; expires_at: string; ai_request_limit: number }>(),
    getInviteRecipient(parsed.data),
  ]);
  if (!enrollment || enrollment.status !== "active" || Date.parse(enrollment.expires_at) <= Date.now())
    redirect(`/admin/users/${parsed.data}?error=${encodeURIComponent("有効な成人向けモニター招待がありません")}`);
  if (!recipient || !(await cloudGeneralMonitorInviteEmailConfigured()))
    redirect(`/admin/users/${parsed.data}?error=${encodeURIComponent("送信先またはメール設定を確認してください")}`);
  try {
    await sendCloudAdultMonitorInviteEmail({
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      expiresAt: enrollment.expires_at,
      aiRequestLimit: enrollment.ai_request_limit,
    });
  } catch {
    redirect(`/admin/users/${parsed.data}?error=${encodeURIComponent("成人向け招待メールを送信できませんでした")}`);
  }
  redirect(`/admin/users/${parsed.data}?message=${encodeURIComponent("成人向け招待メールを再送しました")}`);
}

export async function stopCloudAdultMonitorAction(
  profileId: string,
  formData: FormData,
) {
  const { profile: actor } = await requireAdmin();
  const parsed = stopSchema.safeParse({
    profileId,
    status: value(formData, "status"),
    adminNote: value(formData, "adminNote"),
  });
  if (!parsed.success)
    redirect(
      `/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("停止理由を入力してください")}`,
    );
  const { error } = await createAdminClient().rpc("stop_cloud_adult_monitor", {
    p_actor_profile_id: actor.id,
    p_target_profile_id: parsed.data.profileId,
    p_status: parsed.data.status,
    p_admin_note: parsed.data.adminNote,
  });
  if (error)
    redirect(
      `/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("限定モニターを停止できませんでした")}`,
    );
  revalidatePath(`/admin/users/${parsed.data.profileId}`);
  revalidatePath("/admin/adult-monitors");
  redirect(
    `/admin/users/${parsed.data.profileId}?message=${encodeURIComponent("限定モニターと成人向け全工程を停止しました")}`,
  );
}
