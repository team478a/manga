import assert from "node:assert/strict";
import test from "node:test";
import {
  MONITOR_QUALITY_REVIEW_ADJUDICATION_VERSION,
  deriveMonitorQualityReviewAdjudicationDecision,
  evaluateMonitorQualityReviewAdjudicationTransition,
  monitorQualityReviewAdjudicationRecordSchema,
} from "../src/modules/manga-quality/domain/monitor-quality-review-adjudication.ts";

const disagreementCaseKeys = ["case_000003", "case_000004"];

function payload(caseId = "case_000003", verdict = "good") {
  return {
    case_id: caseId,
    verdict,
    confidence: 5,
    defects: verdict === "bad"
      ? [{ category: "anatomy_hand_error", severity: "major", comment: "" }]
      : [],
    overall_comment: "",
  };
}

function transition(overrides = {}) {
  return evaluateMonitorQualityReviewAdjudicationTransition({
    transition: "start",
    currentStatus: "assigned",
    caseKey: "case_000003",
    disagreementCaseKeys,
    adjudicatorId: "reviewer-c",
    primaryReviewerIds: ["reviewer-a", "reviewer-b"],
    ...overrides,
  });
}

test("裁定recordは既存Human response契約と第三者独立性を検査する", () => {
  const parsed = monitorQualityReviewAdjudicationRecordSchema.parse({
    schema_version: MONITOR_QUALITY_REVIEW_ADJUDICATION_VERSION,
    batch_code: "batch_private_01",
    case_key: "case_000003",
    adjudicator_id: "reviewer-c",
    primary_reviewer_ids: ["reviewer-a", "reviewer-b"],
    status: "submitted",
    independent_payload: payload(),
    final_payload: payload("case_000003", "bad"),
    decision_reason: "画像上の重大な手指破綻を確認したため。",
    revocation_reason: null,
  });
  assert.equal(parsed.final_payload.verdict, "bad");

  assert.throws(() => monitorQualityReviewAdjudicationRecordSchema.parse({
    ...parsed,
    adjudicator_id: "reviewer-a",
  }), /adjudicator must be independent/);
  assert.throws(() => monitorQualityReviewAdjudicationRecordSchema.parse({
    ...parsed,
    final_payload: payload("case_000004", "bad"),
  }), /final payload case must match/);
  assert.throws(() => monitorQualityReviewAdjudicationRecordSchema.parse({
    ...parsed,
    final_payload: { ...payload("case_000003", "bad"), defects: [] },
  }), /bad cases require at least one defect/);
});

test("Blind-firstの状態順序とpayload確定条件を強制する", () => {
  assert.deepEqual(transition(), {
    ready: true,
    code: "ready",
    nextStatus: "in_progress",
  });
  assert.equal(transition({
    transition: "lock_independent",
    independentPayload: payload(),
  }).nextStatus, "independent_locked");
  assert.deepEqual(transition({
    transition: "submit",
    currentStatus: "independent_locked",
    independentPayload: payload(),
    finalPayload: payload("case_000003", "bad"),
    decisionReason: "A/B差分確認後の最終判断。",
  }), {
    ready: true,
    code: "ready",
    nextStatus: "submitted",
  });

  assert.equal(transition({ transition: "submit" }).code, "state_transition_invalid");
  assert.equal(transition({ transition: "lock_independent" }).code, "independent_payload_required");
  assert.equal(transition({
    transition: "submit",
    currentStatus: "independent_locked",
    independentPayload: payload(),
    finalPayload: payload(),
  }).code, "decision_reason_required");
  assert.equal(transition({
    transition: "submit",
    currentStatus: "independent_locked",
    finalPayload: payload(),
    decisionReason: "独立判断を欠いたまま確定しない。",
  }).code, "independent_payload_required");
});

test("一致ケース、Primary本人、重複Primaryを裁定へ入れない", () => {
  assert.equal(transition({
    caseKey: "invalid",
    disagreementCaseKeys: ["invalid"],
  }).code, "case_key_invalid");
  assert.equal(transition({ caseKey: "case_000001" }).code, "case_not_in_disagreement_set");
  assert.equal(transition({ adjudicatorId: "INVALID ID" }).code, "participant_identity_invalid");
  assert.equal(transition({ adjudicatorId: "reviewer-a" }).code, "adjudicator_not_independent");
  assert.equal(transition({
    primaryReviewerIds: ["reviewer-a", "reviewer-a"],
  }).code, "primary_reviewers_not_independent");
});

test("独立判断確定後はdraft保存・再lockを拒否し、提出後は通常編集しない", () => {
  assert.equal(transition({
    transition: "save_draft",
    currentStatus: "independent_locked",
  }).code, "state_transition_invalid");
  assert.equal(transition({
    transition: "lock_independent",
    currentStatus: "independent_locked",
    independentPayload: payload(),
  }).code, "state_transition_invalid");
  assert.equal(transition({
    transition: "save_draft",
    currentStatus: "submitted",
  }).code, "state_transition_invalid");
  assert.equal(transition({
    transition: "revoke",
    currentStatus: "submitted",
    revocationReason: "監査で割り当て不備が判明したため。",
  }).nextStatus, "revoked");
});

test("必要件数がすべて確定するまでneeds_adjudicationを維持する", () => {
  const pending = deriveMonitorQualityReviewAdjudicationDecision({
    disagreementCaseKeys,
    adjudications: [{ caseKey: "case_000003", status: "submitted" }],
  });
  assert.equal(pending.status, "needs_adjudication");
  assert.equal(pending.submittedCount, 1);
  assert.deepEqual(pending.pendingCaseKeys, ["case_000004"]);

  const complete = deriveMonitorQualityReviewAdjudicationDecision({
    disagreementCaseKeys,
    adjudications: disagreementCaseKeys.map((caseKey) => ({ caseKey, status: "submitted" })),
  });
  assert.equal(complete.status, "pilot_adjudication_complete");
  assert.equal(complete.originalAgreementMetricsChanged, false);
  assert.equal(complete.formalBenchmarkEligible, false);
  assert.equal(complete.automaticAdoption, false);
});

test("不要裁定、重複有効裁定、棄権は完了をfail closedで止める", () => {
  const decision = deriveMonitorQualityReviewAdjudicationDecision({
    disagreementCaseKeys,
    adjudications: [
      { caseKey: "case_000003", status: "submitted" },
      { caseKey: "case_000003", status: "assigned" },
      { caseKey: "case_000004", status: "abstained" },
      { caseKey: "case_000001", status: "submitted" },
    ],
  });
  assert.equal(decision.status, "adjudication_blocked");
  assert.ok(decision.blockers.includes("active_adjudication_duplicate:case_000003"));
  assert.ok(decision.blockers.includes("adjudication_abstained:case_000004"));
  assert.ok(decision.blockers.includes("unnecessary_adjudication:case_000001"));
});

test("匿名派生判定は担当者ID・自由記述・時刻を受け取らず返さない", () => {
  const decision = deriveMonitorQualityReviewAdjudicationDecision({
    disagreementCaseKeys,
    adjudications: [],
  });
  const serialized = JSON.stringify(decision);
  assert.equal(serialized.includes("reviewer"), false);
  assert.equal(serialized.includes("comment"), false);
  assert.equal(serialized.includes("submittedAt"), false);
});
