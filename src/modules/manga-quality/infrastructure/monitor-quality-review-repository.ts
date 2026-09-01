import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  evaluateMonitorQualityReviewBatchTransition,
  monitorQualityReviewSlotsForTarget,
  type MonitorQualityReviewSlot,
  type MonitorQualityReviewBatchTransition,
} from "@/modules/manga-quality/domain/monitor-quality-review";

export type MonitorQualityReviewCase = {
  id: string;
  case_key: string;
  display_order: number;
  review_mode: "intrinsic_only";
  allowed_defect_categories: string[];
};

export type MonitorQualityReviewResponse = {
  case_id: string;
  response_payload: {
    verdict: "good" | "borderline" | "bad" | null;
    confidence: number | null;
    defects: Array<{ category: string; severity: "minor" | "major" | "critical"; comment: string }>;
    overall_comment: string;
  };
  case_completed_at: string | null;
};

export type MonitorQualityReviewWorkspace = {
  configured: boolean;
  assignment: null | {
    id: string;
    reviewer_slot: MonitorQualityReviewSlot;
    status: "assigned" | "in_progress" | "submitted" | "revoked";
    consented_at: string | null;
    submitted_at: string | null;
  };
  cases: MonitorQualityReviewCase[];
  responses: MonitorQualityReviewResponse[];
};

export async function loadMonitorQualityReviewWorkspace(
  reviewerProfileId: string,
): Promise<MonitorQualityReviewWorkspace> {
  const admin = createAdminClient();
  const assignmentResult = await admin
    .from("cloud_monitor_quality_review_assignments")
    .select("id,batch_id,reviewer_slot,status,consented_at,submitted_at")
    .eq("reviewer_profile_id", reviewerProfileId)
    .neq("status", "revoked")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string; batch_id: string; reviewer_slot: MonitorQualityReviewSlot;
      status: "assigned" | "in_progress" | "submitted" | "revoked";
      consented_at: string | null; submitted_at: string | null;
    }>();
  if (assignmentResult.error) {
    const missing = /relation .*cloud_monitor_quality_review_assignments.* does not exist|schema cache/i
      .test(assignmentResult.error.message);
    if (missing) return { configured: false, assignment: null, cases: [], responses: [] };
    throw assignmentResult.error;
  }
  if (!assignmentResult.data)
    return { configured: true, assignment: null, cases: [], responses: [] };
  const assignment = assignmentResult.data;
  const [batchResult, casesResult, responsesResult] = await Promise.all([
    admin.from("cloud_monitor_quality_review_batches")
      .select("status,starts_at,expires_at")
      .eq("id", assignment.batch_id).maybeSingle<{ status: string; starts_at: string; expires_at: string }>(),
    admin.from("cloud_monitor_quality_review_cases")
      .select("id,case_key,display_order,review_mode,allowed_defect_categories")
      .eq("batch_id", assignment.batch_id).order("display_order")
      .returns<MonitorQualityReviewCase[]>(),
    admin.from("cloud_monitor_quality_review_responses")
      .select("case_id,response_payload,case_completed_at")
      .eq("assignment_id", assignment.id)
      .returns<MonitorQualityReviewResponse[]>(),
  ]);
  if (batchResult.error || casesResult.error || responsesResult.error)
    throw batchResult.error ?? casesResult.error ?? responsesResult.error;
  const batch = batchResult.data;
  const now = Date.now();
  if (!batch || batch.status !== "active" || Date.parse(batch.starts_at) > now || Date.parse(batch.expires_at) <= now)
    return { configured: true, assignment: null, cases: [], responses: [] };
  return {
    configured: true,
    assignment: {
      id: assignment.id,
      reviewer_slot: assignment.reviewer_slot,
      status: assignment.status,
      consented_at: assignment.consented_at,
      submitted_at: assignment.submitted_at,
    },
    cases: casesResult.data ?? [],
    responses: responsesResult.data ?? [],
  };
}

export async function createMonitorQualityReviewCandidateUrl(input: {
  reviewerProfileId: string;
  assignmentId: string;
  caseId: string;
}) {
  const workspace = await loadMonitorQualityReviewWorkspace(input.reviewerProfileId);
  if (workspace.assignment?.id !== input.assignmentId || workspace.assignment.status === "revoked")
    return null;
  const reviewCase = workspace.cases.find((item) => item.id === input.caseId);
  if (!reviewCase) return null;
  const admin = createAdminClient();
  const { data: storedCase, error } = await admin
    .from("cloud_monitor_quality_review_cases")
    .select("candidate_storage_path")
    .eq("id", input.caseId)
    .maybeSingle<{ candidate_storage_path: string }>();
  if (error || !storedCase) return null;
  const signed = await admin.storage.from("manga-quality-review")
    .createSignedUrl(storedCase.candidate_storage_path, 120);
  return signed.data?.signedUrl ?? null;
}

export async function consentMonitorQualityReview(assignmentId: string) {
  const client = await createClient();
  return client.rpc("consent_cloud_monitor_quality_review", { p_assignment_id: assignmentId });
}

export async function saveMonitorQualityReviewCase(input: {
  assignmentId: string;
  caseId: string;
  payload: Record<string, unknown>;
  complete: boolean;
}) {
  const client = await createClient();
  return client.rpc("save_cloud_monitor_quality_review_case", {
    p_assignment_id: input.assignmentId,
    p_case_id: input.caseId,
    p_payload: input.payload,
    p_complete: input.complete,
  });
}

export async function submitMonitorQualityReview(assignmentId: string) {
  const client = await createClient();
  return client.rpc("submit_cloud_monitor_quality_review", { p_assignment_id: assignmentId });
}

export async function loadMonitorQualityReviewAdminWorkspace() {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const [batches, assignments, cases, responses, enrollments, profiles] = await Promise.all([
    admin.from("cloud_monitor_quality_review_batches").select("id,batch_code,status,review_scope,target_reviewer_count,starts_at,expires_at,created_at").order("created_at", { ascending: false }),
    admin.from("cloud_monitor_quality_review_assignments").select("id,batch_id,reviewer_profile_id,reviewer_slot,status,consented_at,submitted_at,notification_sent_at,notification_send_count,updated_at").order("updated_at", { ascending: false }),
    admin.from("cloud_monitor_quality_review_cases").select("id,batch_id"),
    admin.from("cloud_monitor_quality_review_responses").select("assignment_id,case_id,case_completed_at"),
    admin.from("cloud_general_monitor_enrollments").select("profile_id,status,expires_at").eq("status", "active").lte("starts_at", now).gt("expires_at", now),
    admin.from("profiles").select("id,display_name"),
  ]);
  const error = batches.error ?? assignments.error ?? cases.error ?? responses.error ?? enrollments.error ?? profiles.error;
  if (error) throw error;
  return {
    loadedAt: now,
    batches: batches.data ?? [], assignments: assignments.data ?? [], cases: cases.data ?? [],
    responses: responses.data ?? [], enrollments: enrollments.data ?? [], profiles: profiles.data ?? [],
  };
}

export async function loadMonitorQualityReviewNotificationTargets(batchId: string) {
  const admin = createAdminClient();
  const [batch, assignments] = await Promise.all([
    admin.from("cloud_monitor_quality_review_batches")
      .select("id,status,target_reviewer_count,expires_at")
      .eq("id", batchId)
      .maybeSingle<{ id: string; status: string; target_reviewer_count: number; expires_at: string }>(),
    admin.from("cloud_monitor_quality_review_assignments")
      .select("id,reviewer_profile_id,status,submitted_at,notification_sent_at")
      .eq("batch_id", batchId)
      .neq("status", "revoked")
      .order("reviewer_slot"),
  ]);
  if (batch.error || assignments.error || !batch.data || batch.data.status !== "active") return null;
  if ((assignments.data?.length ?? 0) !== batch.data.target_reviewer_count) return null;
  return { batch: batch.data, assignments: assignments.data ?? [] };
}

export async function recordMonitorQualityReviewNotificationDelivery(input: {
  actorProfileId: string;
  assignmentId: string;
}) {
  const { error } = await createAdminClient().rpc(
    "record_cloud_monitor_quality_review_notification_sent",
    {
      p_actor_profile_id: input.actorProfileId,
      p_assignment_id: input.assignmentId,
    },
  );
  return !error;
}

export async function monitorQualityReviewNotificationTrackingConfigured() {
  const { error } = await createAdminClient()
    .from("cloud_monitor_quality_review_assignments")
    .select("notification_sent_at,notification_send_count")
    .limit(1);
  return !error;
}

export async function setMonitorQualityReviewBatchLifecycle(input: {
  batchId: string;
  transition: MonitorQualityReviewBatchTransition;
}): Promise<{ data: { id: string; status: "active" | "paused" } | null; error: { message: string } | null }> {
  const admin = createAdminClient();
  const [batchResult, casesResult, assignmentsResult] = await Promise.all([
    admin.from("cloud_monitor_quality_review_batches")
      .select("status,review_scope,source_package_sha256,rights_reviewed_at,rights_reviewed_by,starts_at,expires_at")
      .eq("id", input.batchId)
      .maybeSingle<{
        status: string;
        review_scope: string;
        source_package_sha256: string;
        rights_reviewed_at: string;
        rights_reviewed_by: string;
        starts_at: string;
        expires_at: string;
      }>(),
    admin.from("cloud_monitor_quality_review_cases")
      .select("id", { count: "exact", head: true }).eq("batch_id", input.batchId),
    admin.from("cloud_monitor_quality_review_assignments")
      .select("id", { count: "exact", head: true }).eq("batch_id", input.batchId),
  ]);
  if (batchResult.error || casesResult.error || assignmentsResult.error || !batchResult.data)
    return { data: null, error: { message: "monitor_quality_review_batch_not_found" } };

  const readiness = evaluateMonitorQualityReviewBatchTransition({
    transition: input.transition,
    batch: {
      status: batchResult.data.status,
      reviewScope: batchResult.data.review_scope,
      sourcePackageSha256: batchResult.data.source_package_sha256,
      rightsReviewedAt: batchResult.data.rights_reviewed_at,
      rightsReviewedBy: batchResult.data.rights_reviewed_by,
      startsAt: batchResult.data.starts_at,
      expiresAt: batchResult.data.expires_at,
    },
    caseCount: casesResult.count ?? 0,
    assignmentCount: assignmentsResult.count ?? 0,
    now: new Date(),
  });
  if (!readiness.ready)
    return { data: null, error: { message: `monitor_quality_review_${readiness.code}` } };

  const currentStatus = batchResult.data.status;
  const nextStatus = input.transition === "pause" ? "paused" : "active";
  const updateResult = await admin.from("cloud_monitor_quality_review_batches")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", input.batchId)
    .eq("status", currentStatus)
    .select("id,status")
    .maybeSingle<{ id: string; status: "active" | "paused" }>();
  if (updateResult.error || !updateResult.data)
    return { data: null, error: { message: "monitor_quality_review_batch_update_conflict" } };
  return { data: updateResult.data, error: null };
}

export async function assignMonitorQualityReview(input: {
  batchId: string;
  reviewerProfileId: string;
  reviewerSlot: MonitorQualityReviewSlot;
  actorProfileId: string;
}) {
  const admin = createAdminClient();
  const [batch, enrollment] = await Promise.all([
    admin.from("cloud_monitor_quality_review_batches").select("status,target_reviewer_count,starts_at,expires_at").eq("id", input.batchId).maybeSingle<{ status: string; target_reviewer_count: number; starts_at: string; expires_at: string }>(),
    admin.from("cloud_general_monitor_enrollments").select("status,starts_at,expires_at").eq("profile_id", input.reviewerProfileId).maybeSingle<{ status: string; starts_at: string; expires_at: string }>(),
  ]);
  const now = Date.now();
  if (batch.error || enrollment.error || batch.data?.status !== "active" || enrollment.data?.status !== "active"
    || Date.parse(batch.data.starts_at) > now || Date.parse(batch.data.expires_at) <= now
    || Date.parse(enrollment.data.starts_at) > now || Date.parse(enrollment.data.expires_at) <= now)
    return { data: null, error: { message: "monitor_quality_review_assignment_unavailable" } };
  if (!monitorQualityReviewSlotsForTarget(batch.data.target_reviewer_count).includes(input.reviewerSlot))
    return { data: null, error: { message: "monitor_quality_review_slot_outside_target" } };
  return admin.from("cloud_monitor_quality_review_assignments").insert({
    batch_id: input.batchId,
    reviewer_profile_id: input.reviewerProfileId,
    reviewer_slot: input.reviewerSlot,
    assigned_by_profile_id: input.actorProfileId,
  });
}

export async function loadMonitorQualityReviewExport(assignmentId: string) {
  const admin = createAdminClient();
  const assignment = await admin.from("cloud_monitor_quality_review_assignments")
    .select("id,batch_id,reviewer_profile_id,reviewer_slot,status,submitted_at")
    .eq("id", assignmentId).maybeSingle<{
      id: string; batch_id: string; reviewer_profile_id: string;
      reviewer_slot: MonitorQualityReviewSlot; status: string; submitted_at: string | null;
    }>();
  if (assignment.error || !assignment.data || assignment.data.status !== "submitted" || !assignment.data.submitted_at)
    return null;
  const [cases, responses] = await Promise.all([
    admin.from("cloud_monitor_quality_review_cases").select("id,case_key,display_order")
      .eq("batch_id", assignment.data.batch_id).order("display_order"),
    admin.from("cloud_monitor_quality_review_responses").select("case_id,response_payload,case_completed_at")
      .eq("assignment_id", assignmentId),
  ]);
  if (cases.error || responses.error) return null;
  return { assignment: assignment.data, cases: cases.data ?? [], responses: responses.data ?? [] };
}
