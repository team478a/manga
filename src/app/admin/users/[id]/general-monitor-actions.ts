"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { cloudGeneralMonitorBetaEnabled } from "@/lib/cloud-general-monitor";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cloudGeneralMonitorInviteEmailConfigured,
  sendCloudGeneralMonitorInviteEmail,
} from "@/lib/cloud-general-monitor-email";

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

async function getInviteRecipient(profileId: string) {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("user_id,display_name")
    .eq("id", profileId)
    .maybeSingle<{ user_id: string; display_name: string }>();
  if (error || !profile) return null;
  const { data } = await admin.auth.admin.getUserById(profile.user_id);
  if (!data.user?.email) return null;
  return { email: data.user.email, name: profile.display_name || "" };
}

async function inviteTrackingConfigured() {
  const { error } = await createAdminClient()
    .from("cloud_general_monitor_enrollments")
    .select("invite_email_sent_at,invite_email_send_count")
    .limit(1);
  return !error;
}

async function recordInviteDelivery(actorProfileId: string, profileId: string) {
  const { error } = await createAdminClient().rpc(
    "record_cloud_general_monitor_invite_email_sent",
    {
      p_actor_profile_id: actorProfileId,
      p_target_profile_id: profileId,
    },
  );
  return !error;
}

export async function activateCloudGeneralMonitorAction(
  profileId: string,
  formData: FormData,
) {
  const { profile: actor } = await requireAdmin();
  if (!cloudGeneralMonitorBetaEnabled())
    redirect(`/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("一般向けモニターは現在停止中です")}`);
  if (!(await inviteTrackingConfigured()))
    redirect(`/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("招待メール送信履歴のmigrationを先に適用してください")}`);
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
  const recipient = await getInviteRecipient(parsed.data.profileId);
  if (!recipient)
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("招待登録は完了しましたが、送信先メールアドレスを取得できませんでした")}`);
  if (!(await cloudGeneralMonitorInviteEmailConfigured()))
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("招待登録は完了しましたが、メール送信設定が未完了です")}`);
  try {
    await sendCloudGeneralMonitorInviteEmail({
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      expiresAt: new Date(parsed.data.expiresAt).toISOString(),
      aiRequestLimit: parsed.data.aiRequestLimit,
    });
  } catch {
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("招待登録は完了しましたが、メールを送信できませんでした。設定を確認して再送してください")}`);
  }
  if (!(await recordInviteDelivery(actor.id, parsed.data.profileId)))
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("メールは送信されましたが、送信履歴を保存できませんでした")}`);
  revalidatePath(`/admin/users/${parsed.data.profileId}`);
  revalidatePath("/admin/general-monitors");
  redirect(`/admin/users/${parsed.data.profileId}?message=${encodeURIComponent("一般向けモニターへ招待し、案内メールを送信しました")}`);
}

export async function resendCloudGeneralMonitorInviteAction(profileId: string) {
  const { profile: actor } = await requireAdmin();
  if (!cloudGeneralMonitorBetaEnabled())
    redirect(`/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("一般向けモニターは現在停止中です")}`);
  const parsed = z.string().uuid().safeParse(profileId);
  if (!parsed.success)
    redirect("/admin/users?error=ユーザー情報を確認してください");
  if (!(await inviteTrackingConfigured()))
    redirect(`/admin/users/${parsed.data}?error=${encodeURIComponent("招待メール送信履歴のmigrationを先に適用してください")}`);
  const admin = createAdminClient();
  const [{ data: enrollment }, recipient] = await Promise.all([
    admin.from("cloud_general_monitor_enrollments")
      .select("status,expires_at,ai_request_limit")
      .eq("profile_id", parsed.data)
      .maybeSingle<{ status: string; expires_at: string; ai_request_limit: number }>(),
    getInviteRecipient(parsed.data),
  ]);
  if (!enrollment || enrollment.status !== "active" || Date.parse(enrollment.expires_at) <= Date.now())
    redirect(`/admin/users/${parsed.data}?error=${encodeURIComponent("有効なモニター招待がありません")}`);
  if (!recipient || !(await cloudGeneralMonitorInviteEmailConfigured()))
    redirect(`/admin/users/${parsed.data}?error=${encodeURIComponent("送信先またはメール送信設定を確認してください")}`);
  try {
    await sendCloudGeneralMonitorInviteEmail({
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      expiresAt: enrollment.expires_at,
      aiRequestLimit: enrollment.ai_request_limit,
    });
  } catch {
    redirect(`/admin/users/${parsed.data}?error=${encodeURIComponent("招待メールを送信できませんでした")}`);
  }
  if (!(await recordInviteDelivery(actor.id, parsed.data)))
    redirect(`/admin/users/${parsed.data}?error=${encodeURIComponent("メールは送信されましたが、送信履歴を保存できませんでした")}`);
  redirect(`/admin/users/${parsed.data}?message=${encodeURIComponent("招待メールを再送しました")}`);
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
