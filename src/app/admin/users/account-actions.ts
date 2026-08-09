"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { actionFeedbackTarget, actionIdSchema } from "@/lib/action-contracts";
import {
  loadAdminUserActionTarget,
  restoreAdminUser,
  softDeleteAdminUser,
  suspendAdminUser,
} from "@/modules/account/infrastructure/admin-user-repository";

const profileIdSchema = actionIdSchema;

const usersRedirect = (kind: "error" | "message", text: string) =>
  actionFeedbackTarget("/admin/users", kind, text);

async function manageableTarget(profileId: string) {
  const { user: actorUser } = await requireAdmin();
  const parsed = profileIdSchema.safeParse(profileId);
  if (!parsed.success) {
    redirect(usersRedirect("error", "ユーザー情報を確認してください。"));
  }
  if (!hasSupabaseAdminEnv()) {
    redirect(usersRedirect("error", "Supabase管理用設定が必要です。"));
  }

  const targetLoaded = await safelyLoadAdminData("users/action/target", async () => {
    return loadAdminUserActionTarget(parsed.data);
  });
  if (!targetLoaded.ok) {
    redirect(usersRedirect("error", "対象ユーザーを確認できませんでした。"));
  }
  const { data: target, error } = targetLoaded.value;

  if (error || !target) {
    redirect(usersRedirect("error", "対象ユーザーを確認できませんでした。"));
  }
  if (target.user_id === actorUser.id || target.role === "admin") {
    redirect(usersRedirect("error", "管理者アカウントはこの画面から停止・削除できません。"));
  }

  return target;
}

function refreshUserPages(profileId: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${profileId}`);
}

export async function suspendAdminUserAction(profileId: string) {
  const target = await manageableTarget(profileId);
  const operation = await safelyLoadAdminData("users/action/suspend", () =>
    suspendAdminUser(target.user_id),
  );
  if (!operation.ok || operation.value.error) {
    redirect(usersRedirect("error", "ユーザーを停止できませんでした。"));
  }
  refreshUserPages(target.id);
  redirect(usersRedirect("message", "ユーザーの利用を停止しました。"));
}

export async function restoreAdminUserAction(profileId: string) {
  const target = await manageableTarget(profileId);
  const operation = await safelyLoadAdminData("users/action/restore", () =>
    restoreAdminUser(target.user_id),
  );
  if (!operation.ok || operation.value.error) {
    redirect(usersRedirect("error", "ユーザーを再開できませんでした。"));
  }
  refreshUserPages(target.id);
  redirect(usersRedirect("message", "ユーザーの利用を再開しました。"));
}

export async function deleteAdminUserAction(profileId: string) {
  const target = await manageableTarget(profileId);
  const operation = await safelyLoadAdminData("users/action/delete", () =>
    softDeleteAdminUser(target.user_id),
  );
  if (!operation.ok || operation.value.error) {
    redirect(usersRedirect("error", "ユーザーを削除できませんでした。"));
  }
  refreshUserPages(target.id);
  redirect(usersRedirect("message", "ユーザーを削除しました。"));
}
