"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { formString } from "@/app/actions/shared/form-data";
import { setAdultPlanningGrant } from "@/modules/adult-planning/infrastructure/admin-repository";

const featureGrantSchema = z.object({
  profileId: z.string().uuid(),
  status: z.enum(["approved", "suspended", "expired"]),
  source: z.enum(["purchase", "legacy_purchase", "admin_grant", "campaign"]),
  validUntil: z
    .string()
    .trim()
    .refine(
      (value) => !value || Number.isFinite(Date.parse(value)),
      "有効期限を確認してください。",
    )
    .transform((value) => (value ? new Date(value).toISOString() : null)),
  adminNote: z.string().trim().max(500),
});

export async function setCloudAdultPlanningGrantAction(
  profileId: string,
  formData: FormData,
) {
  const { profile: actor } = await requireAdmin();
  const parsed = featureGrantSchema.safeParse({
    profileId,
    status: formString(formData, "status"),
    source: formString(formData, "source"),
    validUntil: formString(formData, "validUntil"),
    adminNote: formString(formData, "adminNote"),
  });
  if (!parsed.success)
    redirect(
      `/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("成人向け企画機能の許可設定を確認してください")}`,
    );

  const operation = await safelyLoadAdminData("users/adult-planning/action", () =>
    setAdultPlanningGrant({
      actorProfileId: actor.id,
      targetProfileId: parsed.data.profileId,
      status: parsed.data.status,
      source: parsed.data.source,
      validUntil: parsed.data.validUntil,
      adminNote: parsed.data.adminNote,
    }),
  );
  if (!operation.ok)
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("成人向け企画機能の許可を更新できませんでした")}`);
  if (!operation.value.targetFound)
    redirect(encodeURI("/admin/users?error=対象ユーザーが見つかりません"));
  if (operation.value.error)
    redirect(
      `/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("成人向け企画機能の許可を更新できませんでした")}`,
    );

  revalidatePath(`/admin/users/${parsed.data.profileId}`);
  redirect(
    `/admin/users/${parsed.data.profileId}?message=${encodeURIComponent("成人向け企画機能の許可を更新しました")}`,
  );
}
