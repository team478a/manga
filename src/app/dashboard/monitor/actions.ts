"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { requireCloudGeneralMonitor } from "@/lib/cloud-general-monitor";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { ValidationError } from "@/lib/domain-errors";
import {
  parseMonitorDiagnostic,
  sanitizeMonitorText,
  sanitizeMonitorUrl,
  validateMonitorScreenshot,
} from "@/lib/monitor-feedback";
import { saveGeneralMonitorFeedback } from "@/modules/general-monitor/infrastructure/monitor-feedback-repository";

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
    let screenshot;
    try {
      screenshot = validateMonitorScreenshot(formData.get("screenshot"));
    } catch {
      throw new ValidationError("スクリーンショットはPNG・JPEG・WebP、5MB以下にしてください。");
    }
    const feedbackId = crypto.randomUUID();
    const diagnostic = parseMonitorDiagnostic(formData.get("diagnostic"));
    const { error } = await saveGeneralMonitorFeedback({
      feedbackId,
      ownerProfileId: profile.id,
      requestType: parsed.requestType,
      title: sanitizeMonitorText(parsed.title),
      workflowStep: parsed.workflowStep,
      rating: parsed.rating,
      outcome: parsed.outcome,
      severity: parsed.severity,
      pageUrl: sanitizeMonitorUrl(parsed.pageUrl) || null,
      environment: sanitizeMonitorText(parsed.environment) || null,
      comment: sanitizeMonitorText(parsed.comment),
      clientContext: diagnostic,
      screenshot,
    });
    if (error) {
      if (error.message.includes("cloud_monitor_feedback_rate_limited")) {
        throw new ValidationError("短時間に多くの報告が送信されています。10分ほど待ってから再度お試しください。");
      }
      throw error;
    }
  } catch (error) {
    redirect(`/dashboard/monitor?error=${encodeURIComponent(safeDomainErrorMessage(error, "フィードバックを保存できませんでした。"))}`);
  }
  revalidatePath("/dashboard/monitor");
  redirect(encodeURI("/dashboard/monitor?message=フィードバックを送信しました"));
}
