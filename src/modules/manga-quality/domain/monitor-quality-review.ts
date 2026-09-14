import { z } from "zod";
import {
  HUMAN_REVIEW_DEFECT_CATEGORIES,
  INTRINSIC_REVIEW_DEFECT_CATEGORIES,
  humanReviewRecordSchema,
} from "./human-review-package.ts";

export const MONITOR_QUALITY_REVIEW_PRIMARY_SLOTS = [
  "reviewer_a",
  "reviewer_b",
] as const;

export const MONITOR_QUALITY_REVIEW_PANEL_SLOTS = [
  "reviewer_c",
  "reviewer_d",
  "reviewer_e",
  "reviewer_f",
  "reviewer_g",
  "reviewer_h",
  "reviewer_i",
] as const;

export const MONITOR_QUALITY_REVIEW_SLOTS = [
  ...MONITOR_QUALITY_REVIEW_PRIMARY_SLOTS,
  ...MONITOR_QUALITY_REVIEW_PANEL_SLOTS,
] as const;

export const MONITOR_QUALITY_REVIEW_DEFAULT_REVIEWER_COUNT = 5;
export const MONITOR_QUALITY_REVIEW_MIN_REVIEWER_COUNT = 2;
export const MONITOR_QUALITY_REVIEW_MAX_REVIEWER_COUNT = 9;
export const MONITOR_PANEL_REVIEW_TEMPLATE_VERSION = "mangai-human-review-panel-v1";

export const monitorQualityReviewSlotSchema = z.enum(MONITOR_QUALITY_REVIEW_SLOTS);
export const monitorQualityReviewPanelSlotSchema = z.enum(MONITOR_QUALITY_REVIEW_PANEL_SLOTS);
export type MonitorQualityReviewSlot = z.infer<typeof monitorQualityReviewSlotSchema>;

export function monitorQualityReviewSlotsForTarget(count: number) {
  if (!Number.isInteger(count)
    || count < MONITOR_QUALITY_REVIEW_MIN_REVIEWER_COUNT
    || count > MONITOR_QUALITY_REVIEW_MAX_REVIEWER_COUNT)
    throw new Error("monitor_quality_review_target_reviewer_count_invalid");
  return MONITOR_QUALITY_REVIEW_SLOTS.slice(0, count);
}

export function isMonitorQualityReviewPrimarySlot(
  slot: MonitorQualityReviewSlot,
): slot is (typeof MONITOR_QUALITY_REVIEW_PRIMARY_SLOTS)[number] {
  return (MONITOR_QUALITY_REVIEW_PRIMARY_SLOTS as readonly string[]).includes(slot);
}

export function describeMonitorQualityReviewSlot(slot: MonitorQualityReviewSlot) {
  const suffix = slot.slice(-1).toUpperCase();
  return isMonitorQualityReviewPrimarySlot(slot)
    ? `Primary Reviewer ${suffix}`
    : `Panel Reviewer ${suffix}`;
}

export const monitorPanelReviewResponseSchema = z
  .object({
    template_version: z.literal(MONITOR_PANEL_REVIEW_TEMPLATE_VERSION),
    slot: monitorQualityReviewPanelSlotSchema,
    reviewer_id: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/),
    reviewer_kind: z.literal("human"),
    independent: z.literal(true),
    reviewed_at: z.iso.datetime({ offset: true }),
    records: z.array(humanReviewRecordSchema).min(1).max(140),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.records.map((record) => record.case_id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", path: ["records"], message: "case IDs must be unique" });
  });

export const monitorQualityReviewDefectCategorySchema = z.enum(
  HUMAN_REVIEW_DEFECT_CATEGORIES,
);

export const monitorQualityReviewDraftSchema = z
  .object({
    caseId: z.string().uuid(),
    verdict: z.enum(["good", "borderline", "bad"]).nullable(),
    confidence: z.number().int().min(1).max(5).nullable(),
    defects: z.array(z.object({
      category: monitorQualityReviewDefectCategorySchema,
      severity: z.enum(["minor", "major", "critical"]),
      comment: z.string().trim().max(1_000).default(""),
    }).strict()).max(30),
    overallComment: z.string().trim().max(2_000),
    complete: z.boolean().default(false),
  })
  .strict();

export type MonitorQualityReviewDraft = z.infer<
  typeof monitorQualityReviewDraftSchema
>;

export function validateCompletedMonitorQualityReview(input: {
  caseKey: string;
  allowedDefectCategories: string[];
  draft: MonitorQualityReviewDraft;
}) {
  const record = humanReviewRecordSchema.parse({
    case_id: input.caseKey,
    verdict: input.draft.verdict,
    confidence: input.draft.confidence,
    defects: input.draft.defects,
    overall_comment: input.draft.overallComment,
  });
  for (const defect of record.defects) {
    if (!input.allowedDefectCategories.includes(defect.category))
      throw new Error("monitor_quality_review_category_not_allowed");
  }
  return record;
}

export const MONITOR_INTRINSIC_DEFECT_CATEGORIES = [
  ...INTRINSIC_REVIEW_DEFECT_CATEGORIES,
] as const;

export const MONITOR_QUALITY_REVIEW_LABELS = {
  anatomy_hand_error: "手・指の形",
  anatomy_body_distortion: "体の形",
  object_fusion: "人物や物の不自然な融合",
  unwanted_text: "意図しない文字",
  unwanted_ui: "意図しない画面・UI",
  unwanted_logo: "意図しないロゴ",
  crop_error: "不自然な切れ・見切れ",
  orientation_error: "上下・向きの誤り",
  gravity_error: "重力・姿勢の不自然さ",
  low_readability: "見づらさ・判別しづらさ",
  other: "その他",
} as const satisfies Partial<Record<
  (typeof HUMAN_REVIEW_DEFECT_CATEGORIES)[number],
  string
>>;

export const MONITOR_QUALITY_REVIEW_PILOT_CASE_COUNT = 28;

export const MONITOR_QUALITY_REVIEW_PRIMARY_EXACT_AGREEMENT_THRESHOLD = 0.9;
export const MONITOR_QUALITY_REVIEW_PRIMARY_KAPPA_THRESHOLD = 0.75;

type MonitorQualityReviewBenchmarkInput = {
  batchStatus: string;
  cases: Array<{ id: string; caseKey: string }>;
  assignments: Array<{
    id: string;
    reviewerSlot: MonitorQualityReviewSlot;
    status: string;
    submittedAt: string | null;
  }>;
  responses: Array<{
    assignmentId: string;
    caseId: string;
    responsePayload: unknown;
    caseCompletedAt: string | null;
  }>;
};

type ParsedMonitorQualityReview = z.infer<typeof humanReviewRecordSchema>;

function monitorReviewSignature(review: ParsedMonitorQualityReview) {
  return JSON.stringify([
    review.verdict,
    review.defects
      .map((defect) => `${defect.category}:${defect.severity}`)
      .sort(),
  ]);
}

function roundMonitorMetric(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function calculatePrimaryVerdictKappa(
  pairs: Array<[ParsedMonitorQualityReview, ParsedMonitorQualityReview]>,
) {
  if (!pairs.length) return 0;
  const verdicts = ["good", "borderline", "bad"] as const;
  const observed = pairs.filter(([a, b]) => a.verdict === b.verdict).length / pairs.length;
  const expected = verdicts.reduce((sum, verdict) => {
    const aRate = pairs.filter(([a]) => a.verdict === verdict).length / pairs.length;
    const bRate = pairs.filter(([, b]) => b.verdict === verdict).length / pairs.length;
    return sum + aRate * bRate;
  }, 0);
  if (expected === 1) return observed === 1 ? 1 : 0;
  return roundMonitorMetric((observed - expected) / (1 - expected));
}

function emptyVerdictCounts() {
  return { good: 0, borderline: 0, bad: 0 };
}

/**
 * Produces an administrator-only, identity-free summary of a completed monitor
 * batch. Reviewer profile IDs, names, comments, and response timestamps never
 * enter the returned object. Primary A/B determine the pilot decision; Panel
 * C-I are supplemental evidence only.
 */
export function summarizeMonitorQualityReviewBenchmark(
  input: MonitorQualityReviewBenchmarkInput,
) {
  const blockers: string[] = [];
  if (input.batchStatus !== "completed") blockers.push("batch_not_completed");
  if (input.cases.length !== MONITOR_QUALITY_REVIEW_PILOT_CASE_COUNT)
    blockers.push("pilot_case_count_invalid");

  const caseIds = new Set(input.cases.map((item) => item.id));
  const assignmentById = new Map(input.assignments.map((item) => [item.id, item]));
  const assignmentBySlot = new Map(input.assignments.map((item) => [item.reviewerSlot, item]));
  if (assignmentById.size !== input.assignments.length)
    blockers.push("assignment_id_duplicate");
  if (assignmentBySlot.size !== input.assignments.length)
    blockers.push("reviewer_slot_duplicate");
  for (const assignment of input.assignments) {
    if (assignment.status !== "submitted" || !assignment.submittedAt)
      blockers.push(`assignment_incomplete:${assignment.reviewerSlot}`);
  }
  for (const slot of MONITOR_QUALITY_REVIEW_PRIMARY_SLOTS) {
    const assignment = assignmentBySlot.get(slot);
    if (!assignment || assignment.status !== "submitted" || !assignment.submittedAt)
      blockers.push(`primary_assignment_incomplete:${slot}`);
  }

  const reviewByAssignmentCase = new Map<string, ParsedMonitorQualityReview>();
  for (const response of input.responses) {
    const assignment = assignmentById.get(response.assignmentId);
    const reviewCase = input.cases.find((item) => item.id === response.caseId);
    if (!assignment || !reviewCase || !caseIds.has(response.caseId)) {
      blockers.push("response_outside_batch");
      continue;
    }
    const key = `${response.assignmentId}:${response.caseId}`;
    if (reviewByAssignmentCase.has(key)) {
      blockers.push("response_duplicate");
      continue;
    }
    if (!response.caseCompletedAt) {
      blockers.push("response_not_completed");
      continue;
    }
    const parsed = humanReviewRecordSchema.safeParse({
      ...(typeof response.responsePayload === "object" && response.responsePayload !== null
        ? response.responsePayload
        : {}),
      case_id: reviewCase.caseKey,
    });
    if (!parsed.success) {
      blockers.push("response_payload_invalid");
      continue;
    }
    reviewByAssignmentCase.set(key, parsed.data);
  }

  const primaryPairs: Array<[ParsedMonitorQualityReview, ParsedMonitorQualityReview]> = [];
  const caseSummaries = input.cases.map((reviewCase) => {
    const primaryA = assignmentBySlot.get("reviewer_a");
    const primaryB = assignmentBySlot.get("reviewer_b");
    const reviewA = primaryA
      ? reviewByAssignmentCase.get(`${primaryA.id}:${reviewCase.id}`)
      : undefined;
    const reviewB = primaryB
      ? reviewByAssignmentCase.get(`${primaryB.id}:${reviewCase.id}`)
      : undefined;
    if (!reviewA || !reviewB) blockers.push(`primary_response_missing:${reviewCase.caseKey}`);
    if (reviewA && reviewB) primaryPairs.push([reviewA, reviewB]);

    for (const assignment of input.assignments) {
      if (!reviewByAssignmentCase.has(`${assignment.id}:${reviewCase.id}`))
        blockers.push(`response_missing:${assignment.reviewerSlot}:${reviewCase.caseKey}`);
    }

    const panelVerdicts = emptyVerdictCounts();
    const panelDefects: Record<string, number> = {};
    const panelConfidences: number[] = [];
    for (const assignment of input.assignments) {
      if (isMonitorQualityReviewPrimarySlot(assignment.reviewerSlot)) continue;
      const review = reviewByAssignmentCase.get(`${assignment.id}:${reviewCase.id}`);
      if (!review) continue;
      panelVerdicts[review.verdict] += 1;
      panelConfidences.push(review.confidence);
      for (const defect of review.defects)
        panelDefects[defect.category] = (panelDefects[defect.category] ?? 0) + 1;
    }

    return {
      caseKey: reviewCase.caseKey,
      primary: reviewA && reviewB ? {
        reviewerAVerdict: reviewA.verdict,
        reviewerBVerdict: reviewB.verdict,
        verdictAgreement: reviewA.verdict === reviewB.verdict,
        exactAgreement: monitorReviewSignature(reviewA) === monitorReviewSignature(reviewB),
      } : null,
      panel: {
        reviewCount: panelConfidences.length,
        verdicts: panelVerdicts,
        averageConfidence: panelConfidences.length
          ? roundMonitorMetric(panelConfidences.reduce((sum, value) => sum + value, 0) / panelConfidences.length)
          : null,
        defects: Object.fromEntries(Object.entries(panelDefects).sort(([a], [b]) => a.localeCompare(b))),
      },
    };
  });

  const uniqueBlockers = [...new Set(blockers)];
  const exactAgreementCount = caseSummaries.filter((item) => item.primary?.exactAgreement).length;
  const verdictAgreementCount = caseSummaries.filter((item) => item.primary?.verdictAgreement).length;
  const primaryCaseCount = primaryPairs.length;
  const exactAgreementRate = primaryCaseCount
    ? roundMonitorMetric(exactAgreementCount / primaryCaseCount)
    : 0;
  const verdictAgreementRate = primaryCaseCount
    ? roundMonitorMetric(verdictAgreementCount / primaryCaseCount)
    : 0;
  const kappa = calculatePrimaryVerdictKappa(primaryPairs);
  const disagreementCaseKeys = caseSummaries
    .filter((item) => item.primary && !item.primary.exactAgreement)
    .map((item) => item.caseKey);
  const exactAgreementPass = primaryCaseCount === input.cases.length
    && exactAgreementRate >= MONITOR_QUALITY_REVIEW_PRIMARY_EXACT_AGREEMENT_THRESHOLD;
  const kappaPass = primaryCaseCount === input.cases.length
    && kappa >= MONITOR_QUALITY_REVIEW_PRIMARY_KAPPA_THRESHOLD;
  const decision = uniqueBlockers.length
    ? "blocked_incomplete"
    : disagreementCaseKeys.length
      ? "needs_adjudication"
      : exactAgreementPass && kappaPass
        ? "pilot_review_passed"
        : "agreement_below_threshold";

  const primaryVerdicts = emptyVerdictCounts();
  const panelVerdicts = emptyVerdictCounts();
  const primaryDefects: Record<string, number> = {};
  const panelDefects: Record<string, number> = {};
  let primaryConfidenceTotal = 0;
  let primaryResponseCount = 0;
  let panelConfidenceTotal = 0;
  let panelResponseCount = 0;
  for (const [key, review] of reviewByAssignmentCase) {
    const assignment = assignmentById.get(key.split(":", 1)[0]);
    if (!assignment) continue;
    const primary = isMonitorQualityReviewPrimarySlot(assignment.reviewerSlot);
    const verdicts = primary ? primaryVerdicts : panelVerdicts;
    const defects = primary ? primaryDefects : panelDefects;
    verdicts[review.verdict] += 1;
    if (primary) {
      primaryConfidenceTotal += review.confidence;
      primaryResponseCount += 1;
    } else {
      panelConfidenceTotal += review.confidence;
      panelResponseCount += 1;
    }
    for (const defect of review.defects)
      defects[defect.category] = (defects[defect.category] ?? 0) + 1;
  }

  return {
    schemaVersion: "mangai-monitor-review-summary-v1" as const,
    anonymized: true as const,
    automaticAdoption: false as const,
    source: {
      caseCount: input.cases.length,
      responseCount: reviewByAssignmentCase.size,
      primaryResponseCount,
      panelResponseCount,
    },
    decision: {
      status: decision,
      blockers: uniqueBlockers,
      exactAgreementThreshold: MONITOR_QUALITY_REVIEW_PRIMARY_EXACT_AGREEMENT_THRESHOLD,
      kappaThreshold: MONITOR_QUALITY_REVIEW_PRIMARY_KAPPA_THRESHOLD,
      exactAgreementPass,
      kappaPass,
      adjudicationRequired: disagreementCaseKeys.length > 0,
      disagreementCaseKeys,
      formalBenchmarkEligible: false as const,
      formalBenchmarkBlockers: [
        `formal_fixture_count_${input.cases.length}_of_140`,
        `formal_independent_reviews_${primaryResponseCount}_of_280`,
      ],
    },
    primary: {
      role: "formal_candidate" as const,
      caseCount: primaryCaseCount,
      exactAgreementCount,
      exactAgreementRate,
      verdictAgreementCount,
      verdictAgreementRate,
      cohenKappa: kappa,
      verdicts: primaryVerdicts,
      averageConfidence: primaryResponseCount
        ? roundMonitorMetric(primaryConfidenceTotal / primaryResponseCount)
        : null,
      defects: Object.fromEntries(Object.entries(primaryDefects).sort(([a], [b]) => a.localeCompare(b))),
    },
    panel: {
      role: "supplemental_only" as const,
      reviewerCount: input.assignments.filter((item) =>
        !isMonitorQualityReviewPrimarySlot(item.reviewerSlot)
      ).length,
      responseCount: panelResponseCount,
      verdicts: panelVerdicts,
      averageConfidence: panelResponseCount
        ? roundMonitorMetric(panelConfidenceTotal / panelResponseCount)
        : null,
      defects: Object.fromEntries(Object.entries(panelDefects).sort(([a], [b]) => a.localeCompare(b))),
    },
    cases: caseSummaries,
  };
}

export type MonitorQualityReviewBatchTransition = "activate" | "pause" | "resume" | "complete";

export type MonitorQualityReviewBatchReadinessCode =
  | "ready"
  | "batch_state_invalid"
  | "review_scope_invalid"
  | "source_package_invalid"
  | "rights_review_invalid"
  | "schedule_invalid"
  | "case_count_invalid"
  | "draft_assignment_exists"
  | "completion_assignment_count_invalid"
  | "completion_reviewer_count_invalid"
  | "completion_assignment_not_submitted"
  | "completion_response_count_invalid";

export function evaluateMonitorQualityReviewBatchTransition(input: {
  transition: MonitorQualityReviewBatchTransition;
  batch: {
    status: string;
    reviewScope: string;
    sourcePackageSha256: string;
    rightsReviewedAt: string;
    rightsReviewedBy: string;
    startsAt: string;
    expiresAt: string;
  };
  caseCount: number;
  assignmentCount: number;
  targetReviewerCount?: number;
  distinctReviewerCount?: number;
  submittedAssignmentCount?: number;
  completedResponseCount?: number;
  now: Date;
}): { ready: boolean; code: MonitorQualityReviewBatchReadinessCode } {
  const expectedState = input.transition === "activate"
    ? "draft"
    : input.transition === "pause"
      ? "active"
      : input.transition === "resume"
        ? "paused"
        : "active";
  if (input.batch.status !== expectedState)
    return { ready: false, code: "batch_state_invalid" };

  if (input.transition === "pause") return { ready: true, code: "ready" };
  if (input.batch.reviewScope !== "PILOT_INTRINSIC_ONLY")
    return { ready: false, code: "review_scope_invalid" };
  if (!/^[0-9a-f]{64}$/.test(input.batch.sourcePackageSha256))
    return { ready: false, code: "source_package_invalid" };

  const rightsReviewedAt = Date.parse(input.batch.rightsReviewedAt);
  if (!Number.isFinite(rightsReviewedAt) || rightsReviewedAt > input.now.getTime()
    || input.batch.rightsReviewedBy.trim().length < 3)
    return { ready: false, code: "rights_review_invalid" };

  const startsAt = Date.parse(input.batch.startsAt);
  const expiresAt = Date.parse(input.batch.expiresAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt)
    || expiresAt <= startsAt
    || (input.transition === "complete" && startsAt > input.now.getTime())
    || (input.transition !== "complete" && expiresAt <= input.now.getTime()))
    return { ready: false, code: "schedule_invalid" };
  if (input.caseCount !== MONITOR_QUALITY_REVIEW_PILOT_CASE_COUNT)
    return { ready: false, code: "case_count_invalid" };
  if (input.transition === "activate" && input.assignmentCount !== 0)
    return { ready: false, code: "draft_assignment_exists" };
  if (input.transition === "complete") {
    const targetReviewerCount = input.targetReviewerCount ?? 0;
    if (input.assignmentCount !== targetReviewerCount)
      return { ready: false, code: "completion_assignment_count_invalid" };
    if ((input.distinctReviewerCount ?? 0) !== targetReviewerCount)
      return { ready: false, code: "completion_reviewer_count_invalid" };
    if ((input.submittedAssignmentCount ?? 0) !== targetReviewerCount)
      return { ready: false, code: "completion_assignment_not_submitted" };
    if ((input.completedResponseCount ?? 0) !== input.caseCount * targetReviewerCount)
      return { ready: false, code: "completion_response_count_invalid" };
  }
  return { ready: true, code: "ready" };
}
