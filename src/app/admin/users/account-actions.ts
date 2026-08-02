"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type TargetProfile = {
  id: string;
  user_id: string;
  role: string;
};

const profileIdSchema = z.string().uuid();

const usersRedirect = (kind: "error" | "message", text: string) =>
  `/admin/users?${kind}=${encodeURIComponent(text)}`;

async function manageableTarget(profileId: string) {
  const { user: actorUser } = await requireAdmin();
  const parsed = profileIdSchema.safeParse(profileId);
  if (!parsed.success) {
    redirect(usersRedirect("error", "ユーザー情報を確認してください。"));
  }
  if (!hasSupabaseAdminEnv()) {
    redirect(usersRedirect("error", "Supabase管理用設定が必要です。"));
  }

  const admin = createAdminClient();
  const { data: target, error } = await admin
    .from("profiles")
    .select("id,user_id,role")
    .eq("id", parsed.data)
    .maybeSingle<TargetProfile>();

  if (error || !target) {
    redirect(usersRedirect("error", "対象ユーザーを確認できませんでした。"));
  }
  if (target.user_id === actorUser.id || target.role === "admin") {
    redirect(usersRedirect("error", "管理者アカウントはこの画面から停止・削除できません。"));
  }

  return { admin, target };
}

function refreshUserPages(profileId: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${profileId}`);
}

export async function suspendAdminUserAction(profileId: string) {
  const { admin, target } = await manageableTarget(profileId);
  const { error } = await admin.auth.admin.updateUserById(target.user_id, {
    ban_duration: "876000h",
  });
  if (error) {
    redirect(usersRedirect("error", "ユーザーを停止できませんでした。"));
  }
  refreshUserPages(target.id);
  redirect(usersRedirect("message", "ユーザーの利用を停止しました。"));
}

export async function restoreAdminUserAction(profileId: string) {
  const { admin, target } = await manageableTarget(profileId);
  const { error } = await admin.auth.admin.updateUserById(target.user_id, {
    ban_duration: "none",
  });
  if (error) {
    redirect(usersRedirect("error", "ユーザーを再開できませんでした。"));
  }
  refreshUserPages(target.id);
  redirect(usersRedirect("message", "ユーザーの利用を再開しました。"));
}

export async function deleteAdminUserAction(profileId: string) {
  const { admin, target } = await manageableTarget(profileId);
  const { error } = await admin.auth.admin.deleteUser(target.user_id, true);
  if (error) {
    redirect(usersRedirect("error", "ユーザーを削除できませんでした。"));
  }
  refreshUserPages(target.id);
  redirect(usersRedirect("message", "ユーザーを削除しました。"));
}
