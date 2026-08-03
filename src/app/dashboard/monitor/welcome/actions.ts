"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireCloudGeneralMonitor } from "@/lib/cloud-general-monitor";
import { createClient } from "@/lib/supabase/server";

export async function completeGeneralMonitorOnboardingAction() {
  const { profile } = await requireProfile();
  let actionError: string | null = null;

  try {
    await requireCloudGeneralMonitor(profile.id);
    const supabase = await createClient();
    const { error } = await supabase.rpc(
      "complete_cloud_general_monitor_onboarding",
    );
    if (error) {
      actionError =
        "初回案内を完了できませんでした。時間をおいてもう一度お試しください。";
    }
  } catch (error) {
    actionError = safeDomainErrorMessage(
      error,
      "モニター利用状況を確認できませんでした。管理者へお問い合わせください。",
    );
  }

  if (actionError)
    redirect(`/dashboard/monitor/welcome?error=${encodeURIComponent(actionError)}`);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/monitor");
  redirect("/dashboard?message=モニター利用を開始しました");
}
