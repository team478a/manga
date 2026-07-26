"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEVICE_TOKEN_DAYS } from "@/lib/desktop-auth";

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
const idSchema = z.string().uuid();

export async function approveDesktopDevice(formData: FormData) {
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success)
    redirect("/dashboard/devices/authorize?error=認証コードを確認してください");
  const { profile } = await requireProfile();
  const admin = createAdminClient();
  const now = new Date();
  const { data: authorization, error } = await admin
    .from("desktop_device_authorizations")
    .select("id, expires_at, scopes")
    .eq("user_code", parsed.data)
    .eq("status", "pending")
    .maybeSingle<{ id: string; expires_at: string; scopes: string[] }>();
  if (error)
    redirect(
      `/dashboard/devices/authorize?error=${encodeURIComponent("認証コードを確認できませんでした")}`,
    );
  if (!authorization || new Date(authorization.expires_at) <= now)
    redirect(
      "/dashboard/devices/authorize?error=認証コードが無効または期限切れです",
    );
  const expectedScopeConfirmation = [...authorization.scopes].sort().join(",");
  if (formData.get("scopeConfirmation") !== expectedScopeConfirmation)
    redirect(
      `/dashboard/devices/authorize?code=${encodeURIComponent(parsed.data)}`,
    );
  const tokenExpiresAt = new Date(
    now.getTime() + DEVICE_TOKEN_DAYS * 86_400_000,
  ).toISOString();
  const { data: updated, error: updateError } = await admin
    .from("desktop_device_authorizations")
    .update({
      profile_id: profile.id,
      status: "approved",
      approved_at: now.toISOString(),
      token_expires_at: tokenExpiresAt,
    })
    .eq("id", authorization.id)
    .eq("status", "pending")
    .gt("expires_at", now.toISOString())
    .select("id")
    .maybeSingle<{ id: string }>();
  if (updateError)
    redirect(
      `/dashboard/devices/authorize?error=${encodeURIComponent("Desktop端末を認証できませんでした")}`,
    );
  if (!updated)
    redirect(
      "/dashboard/devices/authorize?error=認証コードが無効または期限切れです",
    );
  revalidatePath("/dashboard/devices");
  redirect("/dashboard/devices?message=Desktop端末を認証しました");
}

export async function revokeDesktopDevice(formData: FormData) {
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) redirect("/dashboard/devices?error=端末IDが不正です");
  const { profile } = await requireProfile();
  const admin = createAdminClient();
  const { error } = await admin
    .from("desktop_device_authorizations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("profile_id", profile.id)
    .eq("status", "approved");
  if (error)
    redirect(
      `/dashboard/devices?error=${encodeURIComponent("端末認証を解除できませんでした")}`,
    );
  revalidatePath("/dashboard/devices");
  redirect("/dashboard/devices?message=端末認証を解除しました");
}
