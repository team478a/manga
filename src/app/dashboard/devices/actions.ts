"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { DEVICE_TOKEN_DAYS } from "@/lib/desktop-auth";
import { actionIdSchema } from "@/lib/action-contracts";
import { createDesktopDeviceRepository } from "@/modules/desktop-device/infrastructure/desktop-device-repository";

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
const idSchema = actionIdSchema;

export async function approveDesktopDevice(formData: FormData) {
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success)
    redirect(encodeURI("/dashboard/devices/authorize?error=認証コードを確認してください"));
  const { profile } = await requireProfile();
  const repository = createDesktopDeviceRepository();
  const now = new Date();
  const { data: authorization, error } =
    await repository.findPendingByUserCode(parsed.data);
  if (error)
    redirect(
      `/dashboard/devices/authorize?error=${encodeURIComponent("認証コードを確認できませんでした")}`,
    );
  if (!authorization || new Date(authorization.expires_at) <= now)
    redirect(
      encodeURI("/dashboard/devices/authorize?error=認証コードが無効または期限切れです"),
    );
  const expectedScopeConfirmation = [...authorization.scopes].sort().join(",");
  if (formData.get("scopeConfirmation") !== expectedScopeConfirmation)
    redirect(
      `/dashboard/devices/authorize?code=${encodeURIComponent(parsed.data)}`,
    );
  const tokenExpiresAt = new Date(
    now.getTime() + DEVICE_TOKEN_DAYS * 86_400_000,
  ).toISOString();
  const { data: updated, error: updateError } =
    await repository.approvePendingAuthorization({
      id: authorization.id,
      profileId: profile.id,
      approvedAt: now.toISOString(),
      tokenExpiresAt,
    });
  if (updateError)
    redirect(
      `/dashboard/devices/authorize?error=${encodeURIComponent("Desktop端末を認証できませんでした")}`,
    );
  if (!updated)
    redirect(
      encodeURI("/dashboard/devices/authorize?error=認証コードが無効または期限切れです"),
    );
  revalidatePath("/dashboard/devices");
  redirect(encodeURI("/dashboard/devices?message=Desktop端末を認証しました"));
}

export async function revokeDesktopDevice(formData: FormData) {
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) redirect(encodeURI("/dashboard/devices?error=端末IDが不正です"));
  const { profile } = await requireProfile();
  const repository = createDesktopDeviceRepository();
  const { error } = await repository.revokeApprovedAuthorization({
    id: parsed.data,
    profileId: profile.id,
    revokedAt: new Date().toISOString(),
  });
  if (error)
    redirect(
      `/dashboard/devices?error=${encodeURIComponent("端末認証を解除できませんでした")}`,
    );
  revalidatePath("/dashboard/devices");
  redirect(encodeURI("/dashboard/devices?message=端末認証を解除しました"));
}
