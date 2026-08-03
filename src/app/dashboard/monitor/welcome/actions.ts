"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireCloudGeneralMonitor } from "@/lib/cloud-general-monitor";
import { createClient } from "@/lib/supabase/server";

export async function completeGeneralMonitorOnboardingAction() {
  const { profile } = await requireProfile();
  try {
    await requireCloudGeneralMonitor(profile.id);
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "モニター利用状況を確認できませんでした。管理者へお問い合わせください。",
    );
    redirect(`/dashboard/monitor/welcome?error=${encodeURIComponent(message)}`);
  }
  const { error } = await (await createClient()).rpc(
    "complete_cloud_general_monitor_onboarding",
  );
  if (error)
    redirect("/dashboard/monitor/welcome?error=初回案内を完了できませんでした");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/monitor");
  redirect("/dashboard?message=モニター利用を開始しました");
}
