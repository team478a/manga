import type {
  MonitorDiagnostic,
  MonitorScreenshot,
} from "@/lib/monitor-feedback";
import { ValidationError } from "@/lib/domain-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isMissingMonitorFeedbackSchema,
  legacyMonitorFeedbackComment,
} from "./monitor-feedback-schema-compatibility";

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
  screenshots: MonitorScreenshot[];
}) {
  const admin = createAdminClient();
  const storage = admin.storage.from("monitor-feedback");
  const attachmentPaths = input.screenshots.map((screenshot, index) =>
    index === 0
      ? `${input.ownerProfileId}/${input.feedbackId}.${screenshot.extension}`
      : `${input.ownerProfileId}/${input.feedbackId}-${index + 1}.${screenshot.extension}`,
  );
  const uploadedPaths: string[] = [];
  for (const [index, screenshot] of input.screenshots.entries()) {
    const attachmentPath = attachmentPaths[index];
    const upload = await storage.upload(attachmentPath, screenshot.file, {
      contentType: screenshot.file.type,
      upsert: false,
    });
    if (upload.error) {
      if (uploadedPaths.length) await storage.remove(uploadedPaths);
      throw new ValidationError(
        "スクリーンショットを保存できませんでした。画像と合計容量を確認してください。",
      );
    }
    uploadedPaths.push(attachmentPath);
  }
  const attachmentPath = attachmentPaths[0] ?? null;
  const structuredPayload = {
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
  };
  const { error: structuredError } = await admin
    .from("cloud_general_monitor_feedback")
    .insert({ ...structuredPayload, attachment_paths: attachmentPaths });
  if (!isMissingMonitorFeedbackSchema(structuredError)) {
    if (structuredError && uploadedPaths.length)
      await storage.remove(uploadedPaths);
    return { error: structuredError };
  }

  if (attachmentPaths.length > 1) {
    await storage.remove(uploadedPaths);
    throw new ValidationError(
      "複数画像の添付準備が完了していません。時間をおいて再度お試しください。",
    );
  }
  const { error: compatibleError } = await admin
    .from("cloud_general_monitor_feedback")
    .insert(structuredPayload);
  if (!isMissingMonitorFeedbackSchema(compatibleError)) {
    if (compatibleError && uploadedPaths.length)
      await storage.remove(uploadedPaths);
    return { error: compatibleError };
  }

  if (uploadedPaths.length) await storage.remove(uploadedPaths);
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
      attachmentOmitted: uploadedPaths.length > 0,
    }),
  });
  return { error };
}
