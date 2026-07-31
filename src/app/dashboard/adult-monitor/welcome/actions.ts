"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { requireCloudAdultMonitor } from "@/lib/cloud-adult-monitor";
import { createClient } from "@/lib/supabase/server";

export async function completeAdultMonitorOnboardingAction() {
  const { profile } = await requireProfile();
  await requireCloudAdultMonitor(profile.id);
  const { error } = await (await createClient()).rpc(
    "complete_cloud_adult_monitor_onboarding",
  );
  if (error)
    redirect("/dashboard/adult-monitor/welcome?error=初回案内を完了できませんでした");
  revalidatePath("/dashboard/adult-monitor");
  redirect("/dashboard?message=成人向け限定モニターを開始しました");
}
