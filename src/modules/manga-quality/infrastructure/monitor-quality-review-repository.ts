import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  evaluateMonitorQualityReviewBatchTransition,
  monitorQualityReviewDraftSchema,
  monitorQualityReviewSlotsForTarget,
  summarizeMonitorQualityReviewBenchmark,
  type MonitorQualityReviewDraft,
  type MonitorQualityReviewSlot,
  type MonitorQualityReviewBatchTransition,
} from "@/modules/manga-quality/domain/monitor-quality-review";
import type {
  MonitorQualityReviewAdjudicationDifference,
  MonitorQualityReviewAdjudicationStatus,
} from
  "@/modules/manga-quality/domain/monitor-quality-review-adjudication";
import { buildMonitorQualityReviewAdjudicationSummary } from
  "@/modules/manga-quality/domain/monitor-quality-review-adjudication";

export type MonitorQualityReviewAdjudicationAdminRow = {
  id: string;
  batch_id: string;
  case_id: string;
  adjudicator_profile_id: string;
  status: MonitorQualityReviewAdjudicationStatus;
  independent_locked_at: string | null;
  differences_revealed_at: string | null;
  submitted_at: string | null;
  abstained_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

function isMissingAdjudicationSchema(message: string) {
  return /cloud_monitor_quality_review_adjudications.*(does not exist|schema cache)|relation .*cloud_monitor_quality_review_adjudications.* does not exist|could not find .*cloud_monitor_quality_review_adjudications/i
    .test(message);
}

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

export type MonitorQualityReviewAdjudicationWorkspace = {
  configured: boolean;
  adjudication: null | {
    id: string;
    status: MonitorQualityReviewAdjudicationStatus;
    consented_at: string | null;
    independent_locked_at: string | null;
    differences_revealed_at: string | null;
    submitted_at: string | null;
    abstained_at: string | null;
    draft: MonitorQualityReviewDraft | null;
    independentDraft: MonitorQualityReviewDraft | null;
  };
  reviewCase: MonitorQualityReviewCase | null;
  progress: {
    total: number;
    pending: number;
    submitted: number;
    abstained: number;
  };
};

function parseAdjudicationDraft(
  payload: unknown,
  caseId: string,
): MonitorQualityReviewDraft | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const stored = payload as Record<string, unknown>;
  const parsed = monitorQualityReviewDraftSchema.safeParse({
    caseId,
    verdict: stored.verdict ?? null,
    confidence: stored.confidence ?? null,
    defects: stored.defects ?? [],
    overallComment: stored.overall_comment ?? "",
    complete: false,
  });
  return parsed.success ? parsed.data : null;
}

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

export async function loadMonitorQualityReviewAdjudicationWorkspace(
  adjudicatorProfileId: string,
  adjudicationId?: string,
): Promise<MonitorQualityReviewAdjudicationWorkspace> {
  const admin = createAdminClient();
  const adjudications = await admin
    .from("cloud_monitor_quality_review_adjudications")
    .select("id,batch_id,case_id,status,consented_at,draft_payload,independent_payload,independent_locked_at,differences_revealed_at,submitted_at,abstained_at,created_at")
    .eq("adjudicator_profile_id", adjudicatorProfileId)
    .neq("status", "revoked")
    .order("created_at", { ascending: true })
    .limit(100)
    .returns<Array<{
      id: string;
      batch_id: string;
      case_id: string;
      status: MonitorQualityReviewAdjudicationStatus;
      consented_at: string | null;
      draft_payload: unknown;
      independent_payload: unknown;
      independent_locked_at: string | null;
      differences_revealed_at: string | null;
      submitted_at: string | null;
      abstained_at: string | null;
      created_at: string;
    }>>();
  if (adjudications.error) {
    if (isMissingAdjudicationSchema(adjudications.error.message))
      return {
        configured: false,
        adjudication: null,
        reviewCase: null,
        progress: { total: 0, pending: 0, submitted: 0, abstained: 0 },
      };
    throw adjudications.error;
  }

  const rows = adjudications.data ?? [];
  const pendingStatuses = new Set<MonitorQualityReviewAdjudicationStatus>([
    "assigned", "in_progress", "independent_locked",
  ]);
  const current = adjudicationId
    ? rows.find((item) => item.id === adjudicationId)
    : rows.find((item) => pendingStatuses.has(item.status)) ?? rows.at(-1);
  const progress = {
    total: rows.length,
    pending: rows.filter((item) => pendingStatuses.has(item.status)).length,
    submitted: rows.filter((item) => item.status === "submitted").length,
    abstained: rows.filter((item) => item.status === "abstained").length,
  };
  if (!current)
    return { configured: true, adjudication: null, reviewCase: null, progress };

  const [reviewCase, batch] = await Promise.all([
    admin.from("cloud_monitor_quality_review_cases")
      .select("id,case_key,display_order,review_mode,allowed_defect_categories")
      .eq("id", current.case_id)
      .eq("batch_id", current.batch_id)
      .maybeSingle<MonitorQualityReviewCase>(),
    admin.from("cloud_monitor_quality_review_batches")
      .select("status")
      .eq("id", current.batch_id)
      .maybeSingle<{ status: string }>(),
  ]);
  if (reviewCase.error || batch.error) throw reviewCase.error ?? batch.error;
  if (!reviewCase.data || batch.data?.status !== "completed")
    return { configured: true, adjudication: null, reviewCase: null, progress };

  return {
    configured: true,
    adjudication: {
      id: current.id,
      status: current.status,
      consented_at: current.consented_at,
      independent_locked_at: current.independent_locked_at,
      differences_revealed_at: current.differences_revealed_at,
      submitted_at: current.submitted_at,
      abstained_at: current.abstained_at,
      draft: parseAdjudicationDraft(current.draft_payload, current.case_id),
      independentDraft: parseAdjudicationDraft(current.independent_payload, current.case_id),
    },
    reviewCase: reviewCase.data,
    progress,
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

export async function createMonitorQualityReviewAdjudicationCandidateUrl(input: {
  adjudicatorProfileId: string;
  adjudicationId: string;
  caseId: string;
}) {
  const workspace = await loadMonitorQualityReviewAdjudicationWorkspace(input.adjudicatorProfileId);
  if (workspace.adjudication?.id !== input.adjudicationId
    || workspace.reviewCase?.id !== input.caseId)
    return null;
  const admin = createAdminClient();
  const storedCase = await admin.from("cloud_monitor_quality_review_cases")
    .select("candidate_storage_path")
    .eq("id", input.caseId)
    .maybeSingle<{ candidate_storage_path: string }>();
  if (storedCase.error || !storedCase.data) return null;
  const signed = await admin.storage.from("manga-quality-review")
    .createSignedUrl(storedCase.data.candidate_storage_path, 120);
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
    admin.from("cloud_monitor_quality_review_cases").select("id,batch_id,case_key,display_order"),
    admin.from("cloud_monitor_quality_review_responses").select("assignment_id,case_id,case_completed_at"),
    admin.from("cloud_general_monitor_enrollments").select("profile_id,status,expires_at").eq("status", "active").lte("starts_at", now).gt("expires_at", now),
    admin.from("profiles").select("id,display_name"),
  ]);
  const error = batches.error ?? assignments.error ?? cases.error ?? responses.error ?? enrollments.error ?? profiles.error;
  if (error) throw error;
  const adjudications = await admin
    .from("cloud_monitor_quality_review_adjudications")
    .select("id,batch_id,case_id,adjudicator_profile_id,status,independent_locked_at,differences_revealed_at,submitted_at,abstained_at,revoked_at,created_at,updated_at")
    .order("created_at", { ascending: false })
    .returns<MonitorQualityReviewAdjudicationAdminRow[]>();
  if (adjudications.error && !isMissingAdjudicationSchema(adjudications.error.message))
    throw adjudications.error;
  return {
    loadedAt: now,
    batches: batches.data ?? [], assignments: assignments.data ?? [], cases: cases.data ?? [],
    responses: responses.data ?? [], enrollments: enrollments.data ?? [], profiles: profiles.data ?? [],
    adjudicationConfigured: !adjudications.error,
    adjudications: adjudications.data ?? [],
  };
}

export async function consentMonitorQualityReviewAdjudication(input: {
  adjudicationId: string;
  idempotencyKey: string;
}) {
  const client = await createClient();
  return client.rpc("consent_cloud_monitor_quality_review_adjudication", {
    p_adjudication_id: input.adjudicationId,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function saveMonitorQualityReviewAdjudicationDraft(input: {
  adjudicationId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const client = await createClient();
  return client.rpc("save_cloud_monitor_quality_review_adjudication_draft", {
    p_adjudication_id: input.adjudicationId,
    p_payload: input.payload,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function lockMonitorQualityReviewAdjudicationIndependent(input: {
  adjudicationId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const client = await createClient();
  return client.rpc("lock_cloud_monitor_quality_review_adjudication_independent", {
    p_adjudication_id: input.adjudicationId,
    p_payload: input.payload,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function revealMonitorQualityReviewAdjudicationDifferences(input: {
  adjudicationId: string;
  idempotencyKey: string;
}) {
  const client = await createClient();
  return client.rpc("reveal_cloud_monitor_quality_review_adjudication_differences", {
    p_adjudication_id: input.adjudicationId,
    p_idempotency_key: input.idempotencyKey,
  }).returns<MonitorQualityReviewAdjudicationDifference[]>();
}

export async function submitMonitorQualityReviewAdjudication(input: {
  adjudicationId: string;
  payload: Record<string, unknown>;
  decisionReason: string;
  idempotencyKey: string;
}) {
  const client = await createClient();
  return client.rpc("submit_cloud_monitor_quality_review_adjudication", {
    p_adjudication_id: input.adjudicationId,
    p_payload: input.payload,
    p_decision_reason: input.decisionReason,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function abstainMonitorQualityReviewAdjudication(input: {
  adjudicationId: string;
  reason: string;
  idempotencyKey: string;
}) {
  const client = await createClient();
  return client.rpc("abstain_cloud_monitor_quality_review_adjudication", {
    p_adjudication_id: input.adjudicationId,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function monitorQualityReviewAdjudicationConfigured() {
  const { error } = await createAdminClient()
    .from("cloud_monitor_quality_review_adjudications")
    .select("id")
    .limit(1);
  return !error;
}

export async function assignMonitorQualityReviewAdjudication(input: {
  actorProfileId: string;
  batchId: string;
  caseId: string;
  adjudicatorProfileId: string;
  idempotencyKey: string;
}) {
  return createAdminClient().rpc("assign_cloud_monitor_quality_review_adjudication", {
    p_actor_profile_id: input.actorProfileId,
    p_batch_id: input.batchId,
    p_case_id: input.caseId,
    p_adjudicator_profile_id: input.adjudicatorProfileId,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function revokeMonitorQualityReviewAdjudication(input: {
  actorProfileId: string;
  adjudicationId: string;
  reason: string;
  idempotencyKey: string;
}) {
  return createAdminClient().rpc("revoke_cloud_monitor_quality_review_adjudication", {
    p_actor_profile_id: input.actorProfileId,
    p_adjudication_id: input.adjudicationId,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  });
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
}): Promise<{ data: { id: string; status: "active" | "paused" | "completed" } | null; error: { message: string } | null }> {
  const admin = createAdminClient();
  const [batchResult, casesResult, assignmentsResult] = await Promise.all([
    admin.from("cloud_monitor_quality_review_batches")
      .select("status,review_scope,source_package_sha256,rights_reviewed_at,rights_reviewed_by,starts_at,expires_at,target_reviewer_count")
      .eq("id", input.batchId)
      .maybeSingle<{
        status: string;
        review_scope: string;
        source_package_sha256: string;
        rights_reviewed_at: string;
        rights_reviewed_by: string;
        starts_at: string;
        expires_at: string;
        target_reviewer_count: number;
      }>(),
    admin.from("cloud_monitor_quality_review_cases")
      .select("id").eq("batch_id", input.batchId).returns<Array<{ id: string }>>(),
    admin.from("cloud_monitor_quality_review_assignments")
      .select("id,reviewer_profile_id,status,submitted_at")
      .eq("batch_id", input.batchId)
      .neq("status", "revoked")
      .returns<Array<{
        id: string;
        reviewer_profile_id: string;
        status: string;
        submitted_at: string | null;
      }>>(),
  ]);
  if (batchResult.error || casesResult.error || assignmentsResult.error || !batchResult.data)
    return { data: null, error: { message: "monitor_quality_review_batch_not_found" } };

  const cases = casesResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  let completedResponseCount = 0;
  if (input.transition === "complete" && assignments.length) {
    const responseResult = await admin.from("cloud_monitor_quality_review_responses")
      .select("assignment_id,case_id,case_completed_at")
      .in("assignment_id", assignments.map((item) => item.id))
      .returns<Array<{ assignment_id: string; case_id: string; case_completed_at: string | null }>>();
    if (responseResult.error)
      return { data: null, error: { message: "monitor_quality_review_completion_evidence_unavailable" } };
    const caseIds = new Set(cases.map((item) => item.id));
    const assignmentIds = new Set(assignments.map((item) => item.id));
    completedResponseCount = (responseResult.data ?? []).filter((item) =>
      Boolean(item.case_completed_at)
      && caseIds.has(item.case_id)
      && assignmentIds.has(item.assignment_id)
    ).length;
  }

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
    caseCount: cases.length,
    assignmentCount: assignments.length,
    targetReviewerCount: batchResult.data.target_reviewer_count,
    distinctReviewerCount: new Set(assignments.map((item) => item.reviewer_profile_id)).size,
    submittedAssignmentCount: assignments.filter((item) =>
      item.status === "submitted" && Boolean(item.submitted_at)
    ).length,
    completedResponseCount,
    now: new Date(),
  });
  if (!readiness.ready)
    return { data: null, error: { message: `monitor_quality_review_${readiness.code}` } };

  const currentStatus = batchResult.data.status;
  const nextStatus = input.transition === "pause"
    ? "paused"
    : input.transition === "complete"
      ? "completed"
      : "active";
  const updateResult = await admin.from("cloud_monitor_quality_review_batches")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", input.batchId)
    .eq("status", currentStatus)
    .select("id,status")
    .maybeSingle<{ id: string; status: "active" | "paused" | "completed" }>();
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

export async function loadMonitorQualityReviewBenchmarkSummary(batchId: string) {
  const admin = createAdminClient();
  const [batch, cases, assignments] = await Promise.all([
    admin.from("cloud_monitor_quality_review_batches")
      .select("id,status")
      .eq("id", batchId)
      .maybeSingle<{ id: string; status: string }>(),
    admin.from("cloud_monitor_quality_review_cases")
      .select("id,case_key,display_order")
      .eq("batch_id", batchId)
      .order("display_order")
      .returns<Array<{ id: string; case_key: string; display_order: number }>>(),
    admin.from("cloud_monitor_quality_review_assignments")
      .select("id,reviewer_slot,status,submitted_at")
      .eq("batch_id", batchId)
      .neq("status", "revoked")
      .order("reviewer_slot")
      .returns<Array<{
        id: string;
        reviewer_slot: MonitorQualityReviewSlot;
        status: string;
        submitted_at: string | null;
      }>>(),
  ]);
  if (batch.error || cases.error || assignments.error || !batch.data) return null;
  const assignmentRows = assignments.data ?? [];
  const responses = assignmentRows.length
    ? await admin.from("cloud_monitor_quality_review_responses")
      .select("assignment_id,case_id,response_payload,case_completed_at")
      .in("assignment_id", assignmentRows.map((item) => item.id))
      .returns<Array<{
        assignment_id: string;
        case_id: string;
        response_payload: unknown;
        case_completed_at: string | null;
      }>>()
    : { data: [], error: null };
  if (responses.error) return null;
  return summarizeMonitorQualityReviewBenchmark({
    batchStatus: batch.data.status,
    cases: (cases.data ?? []).map((item) => ({ id: item.id, caseKey: item.case_key })),
    assignments: assignmentRows.map((item) => ({
      id: item.id,
      reviewerSlot: item.reviewer_slot,
      status: item.status,
      submittedAt: item.submitted_at,
    })),
    responses: (responses.data ?? []).map((item) => ({
      assignmentId: item.assignment_id,
      caseId: item.case_id,
      responsePayload: item.response_payload,
      caseCompletedAt: item.case_completed_at,
    })),
  });
}

export async function loadMonitorQualityReviewAdjudicationSummary(batchId: string) {
  const benchmarkSummary = await loadMonitorQualityReviewBenchmarkSummary(batchId);
  if (!benchmarkSummary) return null;
  const admin = createAdminClient();
  const [batch, cases, adjudications] = await Promise.all([
    admin.from("cloud_monitor_quality_review_batches")
      .select("batch_code,status")
      .eq("id", batchId)
      .maybeSingle<{ batch_code: string; status: string }>(),
    admin.from("cloud_monitor_quality_review_cases")
      .select("id,case_key")
      .eq("batch_id", batchId)
      .returns<Array<{ id: string; case_key: string }>>(),
    admin.from("cloud_monitor_quality_review_adjudications")
      .select("case_id,status,independent_payload,final_payload")
      .eq("batch_id", batchId)
      .neq("status", "revoked")
      .returns<Array<{
        case_id: string;
        status: Exclude<MonitorQualityReviewAdjudicationStatus, "revoked">;
        independent_payload: unknown;
        final_payload: unknown;
      }>>(),
  ]);
  if (adjudications.error && isMissingAdjudicationSchema(adjudications.error.message)) return null;
  if (batch.error || cases.error || adjudications.error || batch.data?.status !== "completed") return null;
  const caseById = new Map((cases.data ?? []).map((item) => [item.id, item.case_key]));
  const rows = adjudications.data ?? [];
  if (rows.some((item) => !caseById.has(item.case_id))) return null;
  return buildMonitorQualityReviewAdjudicationSummary({
    batchCode: batch.data.batch_code,
    disagreementCaseKeys: benchmarkSummary.decision.disagreementCaseKeys,
    adjudications: rows.map((item) => ({
      caseKey: caseById.get(item.case_id)!,
      status: item.status,
      independentPayload: item.independent_payload,
      finalPayload: item.final_payload,
    })),
  });
}
