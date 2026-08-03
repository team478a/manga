"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { safelyLoadAdminData } from "@/lib/admin-resilience";

export async function setCloudAdultResearchEnabledAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const rawEnabled = formData.get("enabled");
  if (rawEnabled !== "true" && rawEnabled !== "false")
    redirect("/admin/adult-research?error=全体設定を確認してください");

  const operation = await safelyLoadAdminData("adult-research/action", async () => {
    const admin = createAdminClient();
    return admin.rpc("set_cloud_adult_research_enabled", {
      p_actor_profile_id: profile.id,
      p_enabled: rawEnabled === "true",
    });
  });
  if (!operation.ok || operation.value.error)
    redirect(
      "/admin/adult-research?error=成人向け市場分析の全体設定を更新できませんでした",
    );

  revalidatePath("/admin/adult-research");
  revalidatePath("/dashboard/research");
  redirect(
    `/admin/adult-research?message=${encodeURIComponent(
      rawEnabled === "true"
        ? "成人向け市場分析のDB側許可を有効にしました"
        : "成人向け市場分析のDB側許可を停止しました",
    )}`,
  );
}
