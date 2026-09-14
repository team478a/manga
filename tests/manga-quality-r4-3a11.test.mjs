import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  evaluateMonitorQualityReviewBatchTransition,
  MONITOR_QUALITY_REVIEW_PILOT_CASE_COUNT,
} from "../src/modules/manga-quality/domain/monitor-quality-review.ts";

const now = new Date("2026-08-18T12:00:00Z");
const validBatch = {
  status: "draft",
  reviewScope: "PILOT_INTRINSIC_ONLY",
  sourcePackageSha256: "a".repeat(64),
  rightsReviewedAt: "2026-08-18T09:00:00Z",
  rightsReviewedBy: "anonymous",
  startsAt: "2026-08-20T00:00:00+09:00",
  expiresAt: "2026-09-20T00:00:00+09:00",
};

test("Pilot Batchは28枚・権利確認済み・割当0件のdraftだけを事前有効化できる", () => {
  const result = evaluateMonitorQualityReviewBatchTransition({
    transition: "activate",
    batch: validBatch,
    caseCount: MONITOR_QUALITY_REVIEW_PILOT_CASE_COUNT,
    assignmentCount: 0,
    now,
  });
  assert.deepEqual(result, { ready: true, code: "ready" });
});
test("画像不足、期限切れ、既存割当、package照合不備をfail closedにする", () => {
  const cases = [
    {
      expected: "case_count_invalid",
      input: { batch: validBatch, caseCount: 27, assignmentCount: 0 },
    },
    {
      expected: "schedule_invalid",
      input: { batch: { ...validBatch, expiresAt: "2026-08-18T11:59:59Z" }, caseCount: 28, assignmentCount: 0 },
    },
    {
      expected: "draft_assignment_exists",
      input: { batch: validBatch, caseCount: 28, assignmentCount: 1 },
    },
    {
      expected: "source_package_invalid",
      input: { batch: { ...validBatch, sourcePackageSha256: "unknown" }, caseCount: 28, assignmentCount: 0 },
    },
  ];
  for (const item of cases) {
    const result = evaluateMonitorQualityReviewBatchTransition({
      transition: "activate",
      ...item.input,
      now,
    });
    assert.equal(result.ready, false);
    assert.equal(result.code, item.expected);
  }
});

test("停止はactiveだけ、再開はpausedを再検査して許可する", () => {
  assert.deepEqual(evaluateMonitorQualityReviewBatchTransition({
    transition: "pause",
    batch: { ...validBatch, status: "active" },
    caseCount: 0,
    assignmentCount: 2,
    now,
  }), { ready: true, code: "ready" });
  assert.deepEqual(evaluateMonitorQualityReviewBatchTransition({
    transition: "resume",
    batch: { ...validBatch, status: "paused" },
    caseCount: 28,
    assignmentCount: 2,
    now,
  }), { ready: true, code: "ready" });
});

test("完了は目標人数全員の提出と全回答の確定が揃ったactive Batchだけを許可する", () => {
  const completeInput = {
    transition: "complete",
    batch: { ...validBatch, status: "active" },
    caseCount: 28,
    assignmentCount: 5,
    targetReviewerCount: 5,
    distinctReviewerCount: 5,
    submittedAssignmentCount: 5,
    completedResponseCount: 140,
    now: new Date("2026-08-21T00:00:00Z"),
  };
  assert.deepEqual(evaluateMonitorQualityReviewBatchTransition(completeInput), {
    ready: true,
    code: "ready",
  });
  const invalidCases = [
    ["completion_assignment_count_invalid", { assignmentCount: 4 }],
    ["completion_reviewer_count_invalid", { distinctReviewerCount: 4 }],
    ["completion_assignment_not_submitted", { submittedAssignmentCount: 4 }],
    ["completion_response_count_invalid", { completedResponseCount: 139 }],
  ];
  for (const [expected, override] of invalidCases) {
    assert.deepEqual(evaluateMonitorQualityReviewBatchTransition({
      ...completeInput,
      ...override,
    }), { ready: false, code: expected });
  }
});

test("管理者操作はFlag停止中でも検査でき、担当割当はFlagで停止する", async () => {
  const [page, actions, repository] = await Promise.all([
    readFile(new URL("../src/app/admin/general-monitors/quality-review/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/general-monitors/quality-review/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Batchを検査して有効化/);
  assert.match(page, /有効化だけではモニターへ公開されません/);
  assert.match(page, /全回答を検査してBatchを完了/);
  assert.match(page, /回答は削除されません/);
  assert.match(actions, /await requireAdmin\(\)/);
  const lifecycleAction = actions.slice(
    actions.indexOf("export async function setMonitorQualityReviewBatchLifecycleAction"),
    actions.indexOf("export async function assignMonitorQualityReviewAction"),
  );
  assert.doesNotMatch(lifecycleAction, /monitorQualityReviewEnabled/);
  assert.match(repository, /\.eq\("status", currentStatus\)/);
  assert.match(repository, /monitor_quality_review_completion_evidence_unavailable/);
  assert.match(repository, /\.in\("assignment_id", assignments\.map/);
});
