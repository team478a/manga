"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { requireCloudGeneralMonitor } from "@/lib/cloud-general-monitor";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { ValidationError } from "@/lib/domain-errors";
import {
  parseMonitorDiagnostic,
  sanitizeMonitorText,
  sanitizeMonitorUrl,
  validateMonitorScreenshot,
} from "@/lib/monitor-feedback";

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
    const admin = createAdminClient();
    const storage = admin.storage.from("monitor-feedback");
    const attachmentPath = screenshot ? `${profile.id}/${feedbackId}.${screenshot.extension}` : null;
    if (screenshot && attachmentPath) {
      const upload = await storage.upload(attachmentPath, screenshot.file, {
        contentType: screenshot.file.type,
        upsert: false,
      });
      if (upload.error) throw new ValidationError("スクリーンショットを保存できませんでした。画像を確認してください。");
    }
    const { error } = await admin
      .from("cloud_general_monitor_feedback")
      .insert({
        id: feedbackId,
        owner_profile_id: profile.id,
        request_type: parsed.requestType,
        title: sanitizeMonitorText(parsed.title),
        workflow_step: parsed.workflowStep,
        rating: parsed.rating,
        outcome: parsed.outcome,
        severity: parsed.severity,
        page_url: sanitizeMonitorUrl(parsed.pageUrl) || null,
        environment: sanitizeMonitorText(parsed.environment) || null,
        comment: sanitizeMonitorText(parsed.comment),
        client_context: diagnostic,
        attachment_path: attachmentPath,
      });
    if (error) {
      if (attachmentPath) await storage.remove([attachmentPath]);
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
