"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setCloudAdultResearchEnabledAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const rawEnabled = formData.get("enabled");
  if (rawEnabled !== "true" && rawEnabled !== "false")
    redirect("/admin/adult-research?error=全体設定を確認してください");

  const admin = createAdminClient();
  const { error } = await admin.rpc("set_cloud_adult_research_enabled", {
    p_actor_profile_id: profile.id,
    p_enabled: rawEnabled === "true",
  });
  if (error)
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

export async function setCloudAdultAiPlanningEnabledAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const rawEnabled = formData.get("enabled");
  if (rawEnabled !== "true" && rawEnabled !== "false")
    redirect("/admin/adult-research?error=AI企画の全体設定を確認してください");
  const { error } = await createAdminClient().rpc(
    "set_cloud_adult_ai_planning_enabled",
    {
      p_actor_profile_id: profile.id,
      p_enabled: rawEnabled === "true",
    },
  );
  if (error)
    redirect("/admin/adult-research?error=成人向けAI企画の全体設定を更新できませんでした");
  revalidatePath("/admin/adult-research");
  redirect(`/admin/adult-research?message=${encodeURIComponent("成人向けAI企画のDB側設定を更新しました")}`);
}

export async function setCloudAdultScenarioEnabledAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const rawEnabled = formData.get("enabled");
  if (rawEnabled !== "true" && rawEnabled !== "false")
    redirect("/admin/adult-research?error=AIシナリオの全体設定を確認してください");
  const { error } = await createAdminClient().rpc("set_cloud_adult_scenario_enabled", {
    p_actor_profile_id: profile.id,
    p_enabled: rawEnabled === "true",
  });
  if (error)
    redirect("/admin/adult-research?error=成人向けAIシナリオの全体設定を更新できませんでした");
  revalidatePath("/admin/adult-research");
  redirect(`/admin/adult-research?message=${encodeURIComponent("成人向けAIシナリオのDB側設定を更新しました")}`);
}
