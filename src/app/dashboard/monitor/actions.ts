"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { requireCloudGeneralMonitor } from "@/lib/cloud-general-monitor";
import { createClient } from "@/lib/supabase/server";
import { safeDomainErrorMessage } from "@/lib/api-errors";

const feedbackSchema = z.object({
  requestType: z.enum(["feedback", "bug", "improvement", "feature_request"]),
  title: z.string().trim().min(1).max(160),
  workflowStep: z.enum([
    "overall", "research", "proposal", "scenario",
    "storyboard", "canvas", "panel_image",
  ]),
  rating: z.coerce.number().int().min(1).max(5),
  outcome: z.enum(["very_useful", "useful", "neutral", "difficult", "blocked"]),
  severity: z.enum(["none", "minor", "major", "blocked"]),
  pageUrl: z.string().trim().max(500).refine((value) => !value || value.startsWith("/") || value.startsWith("https://")),
  environment: z.string().trim().max(200),
  comment: z.string().trim().min(1).max(2000),
});

export async function submitCloudGeneralMonitorFeedbackAction(formData: FormData) {
  try {
    const { profile } = await requireProfile();
    await requireCloudGeneralMonitor(profile.id);
    const parsed = feedbackSchema.parse({
      requestType: formData.get("requestType"),
      title: formData.get("title"),
      workflowStep: formData.get("workflowStep"),
      rating: formData.get("rating"),
      outcome: formData.get("outcome"),
      severity: formData.get("severity"),
      pageUrl: formData.get("pageUrl"),
      environment: formData.get("environment"),
      comment: formData.get("comment"),
    });
    const { error } = await (await createClient())
      .from("cloud_general_monitor_feedback")
      .insert({
        owner_profile_id: profile.id,
        request_type: parsed.requestType,
        title: parsed.title,
        workflow_step: parsed.workflowStep,
        rating: parsed.rating,
        outcome: parsed.outcome,
        severity: parsed.severity,
        page_url: parsed.pageUrl || null,
        environment: parsed.environment || null,
        comment: parsed.comment,
      });
    if (error) throw error;
  } catch (error) {
    redirect(`/dashboard/monitor?error=${encodeURIComponent(safeDomainErrorMessage(error, "フィードバックを保存できませんでした。"))}`);
  }
  revalidatePath("/dashboard/monitor");
  redirect("/dashboard/monitor?message=フィードバックを送信しました");
}
