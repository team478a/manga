"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { safelyLoadAdminData } from "@/lib/admin-resilience";

const entitlementSchema = z.object({
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

function value(formData: FormData, name: string) {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
}

export async function setCloudAdultResearchEntitlementAction(
  profileId: string,
  formData: FormData,
) {
  const { profile: actor } = await requireAdmin();
  const parsed = entitlementSchema.safeParse({
    profileId,
    status: value(formData, "status"),
    source: value(formData, "source"),
    validUntil: value(formData, "validUntil"),
    adminNote: value(formData, "adminNote"),
  });
  if (!parsed.success)
    redirect(
      `/admin/users/${encodeURIComponent(profileId)}?error=${encodeURIComponent("成人向け市場分析の許可設定を確認してください")}`,
    );

  const operation = await safelyLoadAdminData("users/adult-research/action", async () => {
    const admin = createAdminClient();
    const targetResult = await admin
      .from("profiles")
      .select("id")
      .eq("id", parsed.data.profileId)
      .maybeSingle<{ id: string }>();
    if (!targetResult.data || targetResult.error) return { targetFound: false, error: targetResult.error };
    const result = await admin.rpc("set_cloud_adult_research_entitlement", {
      p_actor_profile_id: actor.id,
      p_target_profile_id: parsed.data.profileId,
      p_status: parsed.data.status,
      p_source: parsed.data.source,
      p_valid_until: parsed.data.validUntil,
      p_admin_note: parsed.data.adminNote,
    });
    return { targetFound: true, error: result.error };
  });
  if (!operation.ok)
    redirect(`/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("成人向け市場分析の許可を更新できませんでした")}`);
  if (!operation.value.targetFound)
    redirect("/admin/users?error=対象ユーザーが見つかりません");
  if (operation.value.error)
    redirect(
      `/admin/users/${parsed.data.profileId}?error=${encodeURIComponent("成人向け市場分析の許可を更新できませんでした")}`,
    );

  revalidatePath(`/admin/users/${parsed.data.profileId}`);
  redirect(
    `/admin/users/${parsed.data.profileId}?message=${encodeURIComponent("成人向け市場分析の許可を更新しました")}`,
  );
}
