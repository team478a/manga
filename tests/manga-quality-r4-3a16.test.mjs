import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { summarizeMonitorQualityReviewBenchmark } from "../src/modules/manga-quality/domain/monitor-quality-review.ts";

function buildCompletedBatch() {
  const cases = Array.from({ length: 28 }, (_, index) => ({
    id: `case-id-${index + 1}`,
    caseKey: `case_${String(index + 1).padStart(6, "0")}`,
  }));
  const slots = ["reviewer_a", "reviewer_b", "reviewer_c", "reviewer_d", "reviewer_e"];
  const assignments = slots.map((reviewerSlot, index) => ({
    id: `assignment-${index + 1}`,
    reviewerSlot,
    status: "submitted",
    submittedAt: "2026-09-14T01:00:00Z",
  }));
  const responses = assignments.flatMap((assignment) => cases.map((reviewCase) => ({
    assignmentId: assignment.id,
    caseId: reviewCase.id,
    responsePayload: {
      verdict: "good",
      confidence: 5,
      defects: [],
      overall_comment: "",
    },
    caseCompletedAt: "2026-09-14T00:30:00Z",
  })));
  return { batchStatus: "completed", cases, assignments, responses };
}

test("完了BatchをPrimary A/Bと補助Panelへ分離して匿名集計する", () => {
  const summary = summarizeMonitorQualityReviewBenchmark(buildCompletedBatch());
  assert.equal(summary.schemaVersion, "mangai-monitor-review-summary-v1");
  assert.equal(summary.anonymized, true);
  assert.equal(summary.automaticAdoption, false);
  assert.equal(summary.source.caseCount, 28);
  assert.equal(summary.source.responseCount, 140);
  assert.equal(summary.source.primaryResponseCount, 56);
  assert.equal(summary.source.panelResponseCount, 84);
  assert.equal(summary.primary.exactAgreementRate, 1);
  assert.equal(summary.primary.cohenKappa, 1);
  assert.equal(summary.panel.role, "supplemental_only");
  assert.equal(summary.decision.status, "pilot_review_passed");
  assert.equal(summary.decision.formalBenchmarkEligible, false);
  assert.deepEqual(summary.decision.formalBenchmarkBlockers, [
    "formal_fixture_count_28_of_140",
    "formal_independent_reviews_56_of_280",
  ]);
  assert.equal(JSON.stringify(summary).includes("assignment-"), false);
  assert.equal(JSON.stringify(summary).includes("reviewerProfileId"), false);
});

test("Primary A/Bの不一致はPanel多数決で自動採用せず第三者裁定へ送る", () => {
  const input = buildCompletedBatch();
  const response = input.responses.find((item) =>
    item.assignmentId === "assignment-2" && item.caseId === "case-id-1"
  );
  response.responsePayload = {
    verdict: "bad",
    confidence: 4,
    defects: [{ category: "anatomy_hand_error", severity: "major", comment: "" }],
    overall_comment: "",
  };
  const summary = summarizeMonitorQualityReviewBenchmark(input);
  assert.equal(summary.primary.exactAgreementCount, 27);
  assert.equal(summary.panel.verdicts.good, 84);
  assert.equal(summary.decision.status, "needs_adjudication");
  assert.deepEqual(summary.decision.disagreementCaseKeys, ["case_000001"]);
  assert.equal(summary.automaticAdoption, false);
});

test("自由記述の差は一致判定や匿名集計へ持ち込まない", () => {
  const input = buildCompletedBatch();
  input.responses.find((item) =>
    item.assignmentId === "assignment-1" && item.caseId === "case-id-1"
  ).responsePayload.overall_comment = "個別の自由記述";
  const summary = summarizeMonitorQualityReviewBenchmark(input);
  assert.equal(summary.cases[0].primary.exactAgreement, true);
  assert.equal(JSON.stringify(summary).includes("個別の自由記述"), false);
});

test("未確定・不正schemaの回答はfail closedで採否を停止する", () => {
  const input = buildCompletedBatch();
  input.responses[0].caseCompletedAt = null;
  input.responses[1].responsePayload.confidence = 9;
  const summary = summarizeMonitorQualityReviewBenchmark(input);
  assert.equal(summary.decision.status, "blocked_incomplete");
  assert.ok(summary.decision.blockers.includes("response_not_completed"));
  assert.ok(summary.decision.blockers.includes("response_payload_invalid"));
});

test("管理者の匿名集計経路だけが回答本文を読み、個人識別子を出力しない", async () => {
  const [repository, route, page] = await Promise.all([
    readFile(new URL("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/general-monitors/quality-review/summary/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/general-monitors/quality-review/page.tsx", import.meta.url), "utf8"),
  ]);
  const summaryLoader = repository.slice(repository.indexOf("export async function loadMonitorQualityReviewBenchmarkSummary"));
  assert.match(summaryLoader, /response_payload/);
  assert.doesNotMatch(summaryLoader, /reviewer_profile_id|display_name|email/);
  assert.match(route, /await requireAdmin\(\)/);
  assert.match(route, /cache-control": "private, no-store/);
  assert.match(page, /正式Benchmarkの140画像要件は未達/);
  assert.match(page, /自動採用・画像削除は行いません/);
});
