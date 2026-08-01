import assert from "node:assert/strict";
import test from "node:test";
import { cloudChapterProductionPlanSchema, isCloudChapterPlanOverdue } from "../src/lib/cloud-chapter-production-plan.ts";

test("章制作計画の入力境界を検証する", () => {
  const valid = { projectId: crypto.randomUUID(), chapterId: crypto.randomUUID(), priority: "high", assigneeName: "担当", dueDate: "2026-08-31", notes: "ネーム確認" };
  assert.equal(cloudChapterProductionPlanSchema.safeParse(valid).success, true);
  assert.equal(cloudChapterProductionPlanSchema.safeParse({ ...valid, priority: "critical" }).success, false);
  assert.equal(cloudChapterProductionPlanSchema.safeParse({ ...valid, notes: "x".repeat(1001) }).success, false);
});

test("未完了章だけを期限超過として扱う", () => {
  assert.equal(isCloudChapterPlanOverdue("2026-07-31", false, "2026-08-01"), true);
  assert.equal(isCloudChapterPlanOverdue("2026-07-31", true, "2026-08-01"), false);
  assert.equal(isCloudChapterPlanOverdue(null, false, "2026-08-01"), false);
});
