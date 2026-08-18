import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  describeMonitorQualityReviewSlot,
  isMonitorQualityReviewPrimarySlot,
  MONITOR_QUALITY_REVIEW_DEFAULT_REVIEWER_COUNT,
  MONITOR_QUALITY_REVIEW_MAX_REVIEWER_COUNT,
  MONITOR_QUALITY_REVIEW_SLOTS,
  monitorPanelReviewResponseSchema,
  monitorQualityReviewSlotsForTarget,
} from "../src/modules/manga-quality/domain/monitor-quality-review.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("既定5名・最大9名の連続した独立枠を提供する", () => {
  assert.equal(MONITOR_QUALITY_REVIEW_DEFAULT_REVIEWER_COUNT, 5);
  assert.equal(MONITOR_QUALITY_REVIEW_MAX_REVIEWER_COUNT, 9);
  assert.deepEqual(monitorQualityReviewSlotsForTarget(5), [
    "reviewer_a", "reviewer_b", "reviewer_c", "reviewer_d", "reviewer_e",
  ]);
  assert.equal(MONITOR_QUALITY_REVIEW_SLOTS.length, 9);
  assert.throws(() => monitorQualityReviewSlotsForTarget(1));
  assert.throws(() => monitorQualityReviewSlotsForTarget(10));
  assert.equal(describeMonitorQualityReviewSlot("reviewer_a"), "Primary Reviewer A");
  assert.equal(describeMonitorQualityReviewSlot("reviewer_e"), "Panel Reviewer E");
});

test("正式A/Bと補助Panel C-Iの回答契約を混在させない", () => {
  assert.equal(isMonitorQualityReviewPrimarySlot("reviewer_a"), true);
  assert.equal(isMonitorQualityReviewPrimarySlot("reviewer_c"), false);
  const panel = monitorPanelReviewResponseSchema.parse({
    template_version: "mangai-human-review-panel-v1",
    slot: "reviewer_c",
    reviewer_id: "monitor_example",
    reviewer_kind: "human",
    independent: true,
    reviewed_at: "2026-08-18T12:00:00+09:00",
    records: [{
      case_id: "case_000001",
      verdict: "good",
      confidence: 5,
      defects: [],
      overall_comment: "",
    }],
  });
  assert.equal(panel.slot, "reviewer_c");
  assert.throws(() => monitorPanelReviewResponseSchema.parse({ ...panel, slot: "reviewer_a" }));
});

test("migrationはBatch上限とA-I枠をDBでもfail closedにする", async () => {
  const [migration, rollback] = await Promise.all([
    read("../supabase/migrations/202608180002_cloud_monitor_quality_review_panel.sql"),
    read("../supabase/rollbacks/202608180002_cloud_monitor_quality_review_panel.sql"),
  ]);
  assert.match(migration, /target_reviewer_count smallint not null default 5/);
  assert.match(migration, /target_reviewer_count between 2 and 9/);
  assert.match(migration, /'reviewer_i'/);
  assert.match(migration, /v_ordinal>v_target/);
  assert.match(migration, /before insert or update of batch_id,reviewer_slot/);
  assert.match(rollback, /rollback_requires_no_panel_assignments/);
  assert.doesNotMatch(rollback, /delete from public\.cloud_monitor_quality_review_assignments/);
});

test("管理画面はBatch単位で5名パネルを割り当て、回答本文は取得しない", async () => {
  const [page, actions, repository] = await Promise.all([
    read("../src/app/admin/general-monitors/quality-review/page.tsx"),
    read("../src/app/admin/general-monitors/quality-review/actions.ts"),
    read("../src/modules/manga-quality/infrastructure/monitor-quality-review-repository.ts"),
  ]);
  assert.match(page, /複数モニターによる独立確認/);
  assert.match(page, /確認者 \{assignments\.length\} \/ \{targetReviewerCount\}名/);
  assert.match(page, /monitorQualityReviewSlotsForTarget/);
  assert.match(actions, /monitorQualityReviewSlotSchema/);
  assert.match(repository, /target_reviewer_count/);
  assert.match(repository, /monitorQualityReviewSlotsForTarget/);
  const adminLoader = repository.slice(
    repository.indexOf("export async function loadMonitorQualityReviewAdminWorkspace"),
    repository.indexOf("export async function setMonitorQualityReviewBatchLifecycle"),
  );
  assert.doesNotMatch(adminLoader, /response_payload/);
});

test("exportはPrimary A/Bと補助Panelを別schemaで出力する", async () => {
  const route = await read("../src/app/admin/general-monitors/quality-review/export/route.ts");
  assert.match(route, /isMonitorQualityReviewPrimarySlot/);
  assert.match(route, /humanReviewResponseSchema\.parse/);
  assert.match(route, /monitorPanelReviewResponseSchema\.parse/);
  assert.match(route, /mangai-human-review-v2/);
  assert.match(route, /MONITOR_PANEL_REVIEW_TEMPLATE_VERSION/);
});
