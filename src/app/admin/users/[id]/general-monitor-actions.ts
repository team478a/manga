"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { cloudGeneralMonitorBetaEnabled } from "@/lib/cloud-general-monitor";
import {
  cloudGeneralMonitorInviteEmailConfigured,
  sendCloudGeneralMonitorExpiryExtendedEmail,
  sendCloudGeneralMonitorInviteEmail,
} from "@/lib/cloud-general-monitor-email";
import {
  activateGeneralMonitor,
  extendGeneralMonitorExpiry,
  generalMonitorInviteTrackingConfigured,
  loadActiveGeneralMonitorInvite,
  loadGeneralMonitorInviteRecipient,
  recordGeneralMonitorInviteDelivery,
  recordGeneralMonitorExpiryNotification,
  stopGeneralMonitor,
} from "@/modules/general-monitor/infrastructure/admin-monitor-repository";

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
const expiryExtensionSchema = z.object({
  profileId: z.string().uuid(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/).refine(
    (input) => Date.parse(`${input}+09:00`) > Date.now(),
  ),
  adminNote: z.string().trim().min(1).max(500),
  notify: z.boolean(),
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
  if (!(await generalMonitorInviteTrackingConfigured()))
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
  const { error } = await activateGeneralMonitor({
    actorProfileId: actor.id,
    profileId: parsed.data.profileId,
    expiresAt: new Date(parsed.data.expiresAt).toISOString(),
    cohort: parsed.data.cohort,
    aiRequestLimit: parsed.data.aiRequestLimit,
    adminNote: parsed.data.adminNote,
  });
  if (error)
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("一般向けモニターを開始できませんでした")}`);
  const recipient = await loadGeneralMonitorInviteRecipient(parsed.data.profileId);
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
  if (!(await recordGeneralMonitorInviteDelivery(actor.id, parsed.data.profileId)))
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
    redirect(encodeURI("/admin/users?error=ユーザー情報を確認してください"));
  if (!(await generalMonitorInviteTrackingConfigured()))
    redirect(`/admin/users/${parsed.data}?error=${encodeURIComponent("招待メール送信履歴のmigrationを先に適用してください")}`);
  const [enrollment, recipient] = await Promise.all([
    loadActiveGeneralMonitorInvite(parsed.data),
    loadGeneralMonitorInviteRecipient(parsed.data),
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
  if (!(await recordGeneralMonitorInviteDelivery(actor.id, parsed.data)))
    redirect(`/admin/users/${parsed.data}?error=${encodeURIComponent("メールは送信されましたが、送信履歴を保存できませんでした")}`);
  redirect(`/admin/users/${parsed.data}?message=${encodeURIComponent("招待メールを再送しました")}`);
}

export async function extendCloudGeneralMonitorExpiryAction(
  profileId: string,
  formData: FormData,
) {
  const { profile: actor } = await requireAdmin();
  if (!cloudGeneralMonitorBetaEnabled())
    redirect(`/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("一般向けモニターは現在停止中です")}`);
  const parsed = expiryExtensionSchema.safeParse({
    profileId,
    expiresAt: value(formData, "expiresAt"),
    adminNote: value(formData, "adminNote"),
    notify: value(formData, "notify") === "yes",
  });
  if (!parsed.success)
    redirect(`/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("現在より後の期限と管理者メモを入力してください")}`);
  const expiresAt = new Date(`${parsed.data.expiresAt}+09:00`).toISOString();
  const { data, error } = await extendGeneralMonitorExpiry({
    actorProfileId: actor.id,
    profileId: parsed.data.profileId,
    expiresAt,
    adminNote: parsed.data.adminNote,
  });
  if (error)
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("期限を延長できませんでした。現在の期限より後を指定し、専用migrationの適用状況を確認してください")}`);
  const result = Array.isArray(data) ? data[0] : data;
  const changed = Boolean(result && typeof result === "object" && "changed" in result && result.changed);
  if (parsed.data.notify) {
    const recipient = await loadGeneralMonitorInviteRecipient(parsed.data.profileId);
    if (!recipient || !(await cloudGeneralMonitorInviteEmailConfigured()))
      redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("期限延長は完了しましたが、送信先またはメール送信設定を確認してください")}`);
    try {
      await sendCloudGeneralMonitorExpiryExtendedEmail({
        profileId: parsed.data.profileId,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        expiresAt,
      });
    } catch {
      redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("期限延長は完了しましたが、案内メールを送信できませんでした")}`);
    }
    if (!(await recordGeneralMonitorExpiryNotification({
      actorProfileId: actor.id,
      profileId: parsed.data.profileId,
      expiresAt,
    })))
      redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("案内メールは送信されましたが、送信履歴を保存できませんでした")}`);
  }
  revalidatePath(`/admin/users/${parsed.data.profileId}`);
  revalidatePath("/admin/general-monitors");
  const message = parsed.data.notify
    ? changed
      ? "期限だけを延長し、案内メールを送信しました"
      : "指定した期限は設定済みです。案内メール送信を確認しました"
    : changed
      ? "AI利用数・上限・開始日を保持したまま期限だけを延長しました"
      : "指定した期限はすでに設定済みです";
  redirect(`/admin/users/${parsed.data.profileId}?message=${encodeURIComponent(message)}`);
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
  const { error } = await stopGeneralMonitor({
    actorProfileId: actor.id,
    profileId: parsed.data.profileId,
    status: parsed.data.status,
    adminNote: parsed.data.adminNote,
  });
  if (error)
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("一般向けモニターを停止できませんでした")}`);
  revalidatePath(`/admin/users/${parsed.data.profileId}`);
  revalidatePath("/admin/general-monitors");
  redirect(`/admin/users/${parsed.data.profileId}?message=${encodeURIComponent("一般向けモニターを停止しました")}`);
}
