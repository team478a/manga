"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { setAdultResearchEnabled } from "@/modules/adult-research/infrastructure/admin-repository";

export async function setCloudAdultResearchEnabledAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const rawEnabled = formData.get("enabled");
  if (rawEnabled !== "true" && rawEnabled !== "false")
    redirect(encodeURI("/admin/adult-research?error=全体設定を確認してください"));

  const operation = await safelyLoadAdminData("adult-research/action", async () => {
    return setAdultResearchEnabled(profile.id, rawEnabled === "true");
  });
  if (!operation.ok || operation.value.error)
    redirect(
      encodeURI("/admin/adult-research?error=成人向け市場分析の全体設定を更新できませんでした"),
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
