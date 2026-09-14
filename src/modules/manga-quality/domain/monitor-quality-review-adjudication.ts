import { z } from "zod";
import {
  humanReviewCaseIdSchema,
  humanReviewRecordSchema,
} from "./human-review-package.ts";

export const MONITOR_QUALITY_REVIEW_ADJUDICATION_VERSION =
  "mangai-monitor-review-adjudication-v1" as const;

export const MONITOR_QUALITY_REVIEW_ADJUDICATION_STATUSES = [
  "assigned",
  "in_progress",
  "independent_locked",
  "submitted",
  "abstained",
  "revoked",
] as const;

export const monitorQualityReviewAdjudicationStatusSchema = z.enum(
  MONITOR_QUALITY_REVIEW_ADJUDICATION_STATUSES,
);

const adjudicatorIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]{2,79}$/);
const decisionReasonSchema = z.string().trim().min(1).max(500);

export const monitorQualityReviewAdjudicationPayloadSchema =
  humanReviewRecordSchema;

export const monitorQualityReviewAdjudicationRecordSchema = z
  .object({
    schema_version: z.literal(MONITOR_QUALITY_REVIEW_ADJUDICATION_VERSION),
    batch_code: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,79}$/),
    case_key: humanReviewCaseIdSchema,
    adjudicator_id: adjudicatorIdSchema,
    primary_reviewer_ids: z.tuple([adjudicatorIdSchema, adjudicatorIdSchema]),
    status: monitorQualityReviewAdjudicationStatusSchema,
    independent_payload: monitorQualityReviewAdjudicationPayloadSchema.nullable(),
    final_payload: monitorQualityReviewAdjudicationPayloadSchema.nullable(),
    decision_reason: z.string().trim().max(500).nullable(),
    revocation_reason: z.string().trim().max(500).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.primary_reviewer_ids).size !== 2)
      context.addIssue({
        code: "custom",
        path: ["primary_reviewer_ids"],
        message: "primary reviewers must be unique",
      });
    if (value.primary_reviewer_ids.includes(value.adjudicator_id))
      context.addIssue({
        code: "custom",
        path: ["adjudicator_id"],
        message: "adjudicator must be independent",
      });
    if (value.independent_payload?.case_id !== value.case_key)
      context.addIssue({
        code: "custom",
        path: ["independent_payload", "case_id"],
        message: "independent payload case must match",
      });
    if (value.final_payload?.case_id !== value.case_key)
      context.addIssue({
        code: "custom",
        path: ["final_payload", "case_id"],
        message: "final payload case must match",
      });
    if (["independent_locked", "submitted"].includes(value.status)
      && !value.independent_payload)
      context.addIssue({
        code: "custom",
        path: ["independent_payload"],
        message: "locked adjudication requires an independent payload",
      });
    if (value.status === "assigned" && value.independent_payload)
      context.addIssue({
        code: "custom",
        path: ["independent_payload"],
        message: "assigned adjudication cannot have an independent payload",
      });
    if (!["submitted", "revoked"].includes(value.status) && value.final_payload)
      context.addIssue({
        code: "custom",
        path: ["final_payload"],
        message: "final payload requires a submitted adjudication",
      });
    if (value.status === "submitted" && !value.final_payload)
      context.addIssue({
        code: "custom",
        path: ["final_payload"],
        message: "submitted adjudication requires a final payload",
      });
    if (value.status === "submitted" && !value.decision_reason?.trim())
      context.addIssue({
        code: "custom",
        path: ["decision_reason"],
        message: "submitted adjudication requires a decision reason",
      });
    if (value.status === "abstained" && !value.decision_reason?.trim())
      context.addIssue({
        code: "custom",
        path: ["decision_reason"],
        message: "abstained adjudication requires a reason",
      });
    if (value.status === "revoked" && !value.revocation_reason?.trim())
      context.addIssue({
        code: "custom",
        path: ["revocation_reason"],
        message: "revoked adjudication requires a reason",
      });
  });

export type MonitorQualityReviewAdjudicationStatus = z.infer<
  typeof monitorQualityReviewAdjudicationStatusSchema
>;

export type MonitorQualityReviewAdjudicationTransition =
  | "start"
  | "save_draft"
  | "lock_independent"
  | "submit"
  | "abstain"
  | "revoke";

export type MonitorQualityReviewAdjudicationReadinessCode =
  | "ready"
  | "case_key_invalid"
  | "case_not_in_disagreement_set"
  | "participant_identity_invalid"
  | "primary_reviewers_not_independent"
  | "adjudicator_not_independent"
  | "state_transition_invalid"
  | "independent_payload_required"
  | "independent_payload_invalid"
  | "final_payload_required"
  | "final_payload_invalid"
  | "decision_reason_required"
  | "revocation_reason_required";

const transitionStates: Record<
  MonitorQualityReviewAdjudicationTransition,
  readonly MonitorQualityReviewAdjudicationStatus[]
> = {
  start: ["assigned"],
  save_draft: ["assigned", "in_progress"],
  lock_independent: ["assigned", "in_progress"],
  submit: ["independent_locked"],
  abstain: ["in_progress", "independent_locked"],
  revoke: ["assigned", "in_progress", "independent_locked", "submitted", "abstained"],
};

const transitionNextStatus: Record<
  MonitorQualityReviewAdjudicationTransition,
  MonitorQualityReviewAdjudicationStatus
> = {
  start: "in_progress",
  save_draft: "in_progress",
  lock_independent: "independent_locked",
  submit: "submitted",
  abstain: "abstained",
  revoke: "revoked",
};

function payloadMatchesCase(payload: unknown, caseKey: string) {
  const parsed = monitorQualityReviewAdjudicationPayloadSchema.safeParse(payload);
  return parsed.success && parsed.data.case_id === caseKey;
}

export function evaluateMonitorQualityReviewAdjudicationTransition(input: {
  transition: MonitorQualityReviewAdjudicationTransition;
  currentStatus: MonitorQualityReviewAdjudicationStatus;
  caseKey: string;
  disagreementCaseKeys: readonly string[];
  adjudicatorId: string;
  primaryReviewerIds: readonly [string, string];
  independentPayload?: unknown;
  finalPayload?: unknown;
  decisionReason?: string;
  revocationReason?: string;
}): {
  ready: boolean;
  code: MonitorQualityReviewAdjudicationReadinessCode;
  nextStatus: MonitorQualityReviewAdjudicationStatus | null;
} {
  const reject = (code: MonitorQualityReviewAdjudicationReadinessCode) => ({
    ready: false as const,
    code,
    nextStatus: null,
  });
  if (!humanReviewCaseIdSchema.safeParse(input.caseKey).success)
    return reject("case_key_invalid");
  if (!input.disagreementCaseKeys.includes(input.caseKey))
    return reject("case_not_in_disagreement_set");
  if (!adjudicatorIdSchema.safeParse(input.adjudicatorId).success
    || input.primaryReviewerIds.some((id) => !adjudicatorIdSchema.safeParse(id).success))
    return reject("participant_identity_invalid");
  if (new Set(input.primaryReviewerIds).size !== 2)
    return reject("primary_reviewers_not_independent");
  if (input.primaryReviewerIds.includes(input.adjudicatorId))
    return reject("adjudicator_not_independent");
  if (!transitionStates[input.transition].includes(input.currentStatus))
    return reject("state_transition_invalid");
  if (input.transition === "lock_independent") {
    if (input.independentPayload === undefined)
      return reject("independent_payload_required");
    if (!payloadMatchesCase(input.independentPayload, input.caseKey))
      return reject("independent_payload_invalid");
  }
  if (input.transition === "submit") {
    if (input.independentPayload === undefined)
      return reject("independent_payload_required");
    if (!payloadMatchesCase(input.independentPayload, input.caseKey))
      return reject("independent_payload_invalid");
    if (input.finalPayload === undefined)
      return reject("final_payload_required");
    if (!payloadMatchesCase(input.finalPayload, input.caseKey))
      return reject("final_payload_invalid");
    if (!decisionReasonSchema.safeParse(input.decisionReason).success)
      return reject("decision_reason_required");
  }
  if (input.transition === "abstain"
    && !decisionReasonSchema.safeParse(input.decisionReason).success)
    return reject("decision_reason_required");
  if (input.transition === "revoke"
    && !decisionReasonSchema.safeParse(input.revocationReason).success)
    return reject("revocation_reason_required");
  return {
    ready: true,
    code: "ready",
    nextStatus: transitionNextStatus[input.transition],
  };
}

export type MonitorQualityReviewAdjudicationDecisionStatus =
  | "not_required"
  | "needs_adjudication"
  | "adjudication_blocked"
  | "pilot_adjudication_complete";

/**
 * Produces an identity-free workflow decision. Adjudication resolves final
 * labels only; it never changes the original agreement metrics or formal
 * benchmark eligibility.
 */
export function deriveMonitorQualityReviewAdjudicationDecision(input: {
  disagreementCaseKeys: readonly string[];
  adjudications: ReadonlyArray<{
    caseKey: string;
    status: MonitorQualityReviewAdjudicationStatus;
  }>;
}) {
  const requiredCaseKeys = [...new Set(input.disagreementCaseKeys)].sort();
  const requiredSet = new Set(requiredCaseKeys);
  const blockers: string[] = [];
  const activeByCase = new Map<string, MonitorQualityReviewAdjudicationStatus>();

  for (const adjudication of input.adjudications) {
    if (!requiredSet.has(adjudication.caseKey)) {
      blockers.push(`unnecessary_adjudication:${adjudication.caseKey}`);
      continue;
    }
    if (adjudication.status === "revoked") continue;
    if (activeByCase.has(adjudication.caseKey)) {
      blockers.push(`active_adjudication_duplicate:${adjudication.caseKey}`);
      continue;
    }
    activeByCase.set(adjudication.caseKey, adjudication.status);
    if (adjudication.status === "abstained")
      blockers.push(`adjudication_abstained:${adjudication.caseKey}`);
  }

  const submittedCaseKeys = requiredCaseKeys.filter(
    (caseKey) => activeByCase.get(caseKey) === "submitted",
  );
  const pendingCaseKeys = requiredCaseKeys.filter(
    (caseKey) => activeByCase.get(caseKey) !== "submitted",
  );
  const uniqueBlockers = [...new Set(blockers)];
  const status: MonitorQualityReviewAdjudicationDecisionStatus =
    requiredCaseKeys.length === 0
      ? "not_required"
      : uniqueBlockers.length
        ? "adjudication_blocked"
        : submittedCaseKeys.length === requiredCaseKeys.length
          ? "pilot_adjudication_complete"
          : "needs_adjudication";

  return {
    schemaVersion: MONITOR_QUALITY_REVIEW_ADJUDICATION_VERSION,
    anonymized: true as const,
    automaticAdoption: false as const,
    originalAgreementMetricsChanged: false as const,
    formalBenchmarkEligible: false as const,
    status,
    requiredCount: requiredCaseKeys.length,
    submittedCount: submittedCaseKeys.length,
    pendingCount: pendingCaseKeys.length,
    blockers: uniqueBlockers,
    requiredCaseKeys,
    submittedCaseKeys,
    pendingCaseKeys,
  };
}
