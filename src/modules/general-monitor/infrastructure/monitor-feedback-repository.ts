import type { MonitorDiagnostic } from "@/lib/monitor-feedback";
import { ValidationError } from "@/lib/domain-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isMissingMonitorFeedbackSchema,
  legacyMonitorFeedbackComment,
} from "./monitor-feedback-schema-compatibility";

type MonitorScreenshot = {
  file: File;
  extension: string;
} | null;

export async function saveGeneralMonitorFeedback(input: {
  feedbackId: string;
  ownerProfileId: string;
  requestType: "feedback" | "bug" | "improvement" | "feature_request";
  title: string;
  workflowStep:
    | "overall"
    | "research"
    | "proposal"
    | "scenario"
    | "storyboard"
    | "canvas"
    | "panel_image";
  rating: number;
  outcome: "very_useful" | "useful" | "neutral" | "difficult" | "blocked";
  severity: "none" | "minor" | "major" | "blocked";
  pageUrl: string | null;
  environment: string | null;
  comment: string;
  clientContext: MonitorDiagnostic;
  screenshot: MonitorScreenshot;
}) {
  const admin = createAdminClient();
  const storage = admin.storage.from("monitor-feedback");
  const attachmentPath = input.screenshot
    ? `${input.ownerProfileId}/${input.feedbackId}.${input.screenshot.extension}`
    : null;
  if (input.screenshot && attachmentPath) {
    const upload = await storage.upload(attachmentPath, input.screenshot.file, {
      contentType: input.screenshot.file.type,
      upsert: false,
    });
    if (upload.error)
      throw new ValidationError(
        "スクリーンショットを保存できませんでした。画像を確認してください。",
      );
  }
  const { error: structuredError } = await admin.from("cloud_general_monitor_feedback").insert({
    id: input.feedbackId,
    owner_profile_id: input.ownerProfileId,
    request_type: input.requestType,
    title: input.title,
    workflow_step: input.workflowStep,
    rating: input.rating,
    outcome: input.outcome,
    severity: input.severity,
    page_url: input.pageUrl,
    environment: input.environment,
    comment: input.comment,
    client_context: input.clientContext,
    attachment_path: attachmentPath,
  });
  if (!isMissingMonitorFeedbackSchema(structuredError)) {
    if (structuredError && attachmentPath) await storage.remove([attachmentPath]);
    return { error: structuredError };
  }

  if (attachmentPath) await storage.remove([attachmentPath]);
  const { error } = await admin.from("cloud_general_monitor_feedback").insert({
    id: input.feedbackId,
    owner_profile_id: input.ownerProfileId,
    workflow_step: input.workflowStep,
    rating: input.rating,
    outcome: input.outcome,
    comment: legacyMonitorFeedbackComment({
      requestType: input.requestType,
      title: input.title,
      severity: input.severity,
      comment: input.comment,
      attachmentOmitted: Boolean(attachmentPath),
    }),
  });
  return { error };
}
