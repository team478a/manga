"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { requireCloudGeneralMonitor } from "@/lib/cloud-general-monitor";
import { createClient } from "@/lib/supabase/server";

export async function completeGeneralMonitorOnboardingAction() {
  const { profile } = await requireProfile();
  await requireCloudGeneralMonitor(profile.id);
  const { error } = await (await createClient()).rpc(
    "complete_cloud_general_monitor_onboarding",
  );
  if (error)
    redirect("/dashboard/monitor/welcome?error=初回案内を完了できませんでした");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/monitor");
  redirect("/dashboard?message=モニター利用を開始しました");
}
