"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formString } from "@/app/actions/shared/form-data";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { requireAdmin } from "@/lib/auth";
import { cloudAiAdminPlanKeys } from "@/modules/cloud-ai/domain/admin-user-entitlement";
import {
  recordCloudAiAdminAudit,
  updateCloudAiAdminUserEntitlement,
} from "@/modules/cloud-ai/infrastructure/admin-cloud-ai-repository";

const cloudAiEntitlementSchema = z.object({
  profileId: z.string().uuid(),
  planKey: z.enum(cloudAiAdminPlanKeys),
  durationDays: z.coerce.number().int().min(1).max(90),
});

const userPath = (profileId: string) =>
  `/admin/users/${encodeURIComponent(profileId)}`;

export async function updateCloudAiUserEntitlementAction(
  profileId: string,
  formData: FormData,
) {
  const { profile: actor } = await requireAdmin();
  const parsed = cloudAiEntitlementSchema.safeParse({
    profileId,
    planKey: formString(formData, "planKey"),
    durationDays: formString(formData, "durationDays"),
  });
  if (!parsed.success)
    redirect(
      `${userPath(profileId)}?error=${encodeURIComponent("Cloud AI利用枠の設定を確認してください")}`,
    );

  const operation = await safelyLoadAdminData("users/cloud-ai/action", () =>
    updateCloudAiAdminUserEntitlement({
      profileId: parsed.data.profileId,
      planKey: parsed.data.planKey,
      durationDays: parsed.data.durationDays,
      now: new Date(),
    }),
  );
  if (!operation.ok)
    redirect(
      `${userPath(parsed.data.profileId)}?error=${encodeURIComponent("Cloud AI利用枠を更新できませんでした")}`,
    );

  const messages = {
    not_found: "Cloud AI利用枠が見つかりません",
    stripe_managed: "Stripe管理中の利用枠は管理画面から変更できません",
    load_failed: "Cloud AI利用状況を確認できませんでした",
    credits_reserved: "予約中creditがあるため、完了または取消後に変更してください",
    active_jobs: "処理中のCloud AI Jobがあるため、完了または取消後に変更してください",
    plan_unavailable: "選択したCloud AI Planは利用できません",
    update_failed: "Cloud AI利用枠を更新できませんでした",
  } as const;
  if (operation.value.status !== "updated")
    redirect(
      `${userPath(parsed.data.profileId)}?error=${encodeURIComponent(messages[operation.value.status])}`,
    );

  const audit = await safelyLoadAdminData("users/cloud-ai/audit", () =>
    recordCloudAiAdminAudit({
      actorId: actor.id,
      action: "update_user_entitlement",
      targetType: "cloud_ai_entitlement",
      targetId: parsed.data.profileId,
      before: operation.value.before,
      after: operation.value.after,
    }),
  );
  if (!audit.ok)
    redirect(
      `${userPath(parsed.data.profileId)}?error=${encodeURIComponent("利用枠は更新されましたが、監査記録を保存できませんでした")}`,
    );

  revalidatePath(userPath(parsed.data.profileId));
  revalidatePath("/admin/cloud-ai");
  redirect(
    `${userPath(parsed.data.profileId)}?message=${encodeURIComponent("Cloud AI利用枠を更新しました")}`,
  );
}
