import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isMissingMonitorFeedbackSchema,
  legacyQualityFeedbackComment,
} from "./monitor-feedback-schema-compatibility";

type QualityFeedbackInput = {
  ownerProfileId: string;
  workflowStep: "canvas" | "panel_image";
  rating: number;
  outcome: "very_useful" | "difficult" | "blocked";
  comment: string;
  targetScope: "page" | "panel";
  projectId: string;
  pageId: string;
  panelId: string | null;
  pageNumber: number;
  panelName: string | null;
  verdict: "accepted" | "needs_revision" | "unusable";
  issueType: string;
  severity: "none" | "minor" | "major" | "blocked";
  generationJobId: string | null;
  providerId: string | null;
  modelId: string | null;
  generationCount: number;
  generationCostMicros: number;
  generationElapsedMs: number;
};

export async function saveMonitorQualityFeedback(input: QualityFeedbackInput) {
  const admin = createAdminClient();
  const { error: structuredError } = await admin
    .from("cloud_general_monitor_feedback")
    .insert({
      owner_profile_id: input.ownerProfileId,
      workflow_step: input.workflowStep,
      rating: input.rating,
      outcome: input.outcome,
      comment: input.comment,
      target_scope: input.targetScope,
      project_id: input.projectId,
      page_id: input.pageId,
      panel_id: input.panelId,
      page_number_snapshot: input.pageNumber,
      panel_name_snapshot: input.panelName,
      verdict: input.verdict,
      issue_type: input.issueType,
      severity: input.severity,
      generation_job_id: input.generationJobId,
      provider_id: input.providerId,
      model_id: input.modelId,
      generation_count: input.generationCount,
      generation_cost_micros: input.generationCostMicros,
      generation_elapsed_ms: input.generationElapsedMs,
    });
  if (structuredError && !isMissingMonitorFeedbackSchema(structuredError))
    throw structuredError;
  if (!structuredError) return;

  const { error } = await admin.from("cloud_general_monitor_feedback").insert({
    owner_profile_id: input.ownerProfileId,
    workflow_step: input.workflowStep,
    rating: input.rating,
    outcome: input.outcome,
    comment: legacyQualityFeedbackComment({
      verdict: input.verdict,
      issueType: input.issueType,
      severity: input.severity,
      pageNumber: input.pageNumber,
      panelName: input.panelName,
      comment: input.comment,
    }),
  });
  if (error) throw error;
}
