"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { requireCloudGeneralMonitor } from "@/lib/cloud-general-monitor";
import { createClient } from "@/lib/supabase/server";
import { safeDomainErrorMessage } from "@/lib/api-errors";

const feedbackSchema = z.object({
  workflowStep: z.enum([
    "overall", "research", "proposal", "scenario",
    "storyboard", "canvas", "panel_image",
  ]),
  rating: z.coerce.number().int().min(1).max(5),
  outcome: z.enum(["very_useful", "useful", "neutral", "difficult", "blocked"]),
  comment: z.string().trim().min(1).max(2000),
});

export async function submitCloudGeneralMonitorFeedbackAction(formData: FormData) {
  try {
    const { profile } = await requireProfile();
    await requireCloudGeneralMonitor(profile.id);
    const parsed = feedbackSchema.parse({
      workflowStep: formData.get("workflowStep"),
      rating: formData.get("rating"),
      outcome: formData.get("outcome"),
      comment: formData.get("comment"),
    });
    const { error } = await (await createClient())
      .from("cloud_general_monitor_feedback")
      .insert({
        owner_profile_id: profile.id,
        workflow_step: parsed.workflowStep,
        rating: parsed.rating,
        outcome: parsed.outcome,
        comment: parsed.comment,
      });
    if (error) throw error;
  } catch (error) {
    redirect(`/dashboard/monitor?error=${encodeURIComponent(safeDomainErrorMessage(error, "フィードバックを保存できませんでした。"))}`);
  }
  revalidatePath("/dashboard/monitor");
  redirect("/dashboard/monitor?message=フィードバックを送信しました");
}
