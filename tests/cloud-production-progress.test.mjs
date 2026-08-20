import assert from "node:assert/strict";
import test from "node:test";
import { buildCloudProductionProgress } from "../src/lib/cloud-production-progress.ts";

test("画像配置と最新ジョブからページ単位の進捗を作る", () => {
  const report = buildCloudProductionProgress({
    pages: [
      { pageId: "page-1", pageNumber: 1, totalPanelCount: 2, completedPanelCount: 2 },
      { pageId: "page-2", pageNumber: 2, totalPanelCount: 2, completedPanelCount: 0 },
      { pageId: "page-3", pageNumber: 3, totalPanelCount: 1, completedPanelCount: 0 },
    ],
    jobs: [
      { page_id: "page-2", target_panel_id: "panel-1", operation_id: "run-2", status: "running", created_at: "2026-07-31T02:00:00Z" },
      { page_id: "page-2", target_panel_id: "panel-1", operation_id: "run-1", status: "failed", created_at: "2026-07-31T01:00:00Z" },
      { page_id: "page-3", target_panel_id: "panel-2", status: "failed", created_at: "2026-07-31T02:00:00Z" },
    ],
  });
  assert.equal(report.imageReadyPageCount, 1);
  assert.equal(report.generatingPageCount, 1);
  assert.equal(report.failedPageCount, 1);
  assert.deepEqual(report.pages.map((page) => page.status), [
    "images_ready",
    "generating",
    "needs_attention",
  ]);
  assert.equal(report.pages[1].failedPanelCount, 0);
});

test("同時に作った複数候補は1コマとして進捗集計する", () => {
  const report = buildCloudProductionProgress({
    pages: [
      { pageId: "page-1", pageNumber: 1, totalPanelCount: 1, completedPanelCount: 0 },
    ],
    jobs: [
      { page_id: "page-1", target_panel_id: "panel-1", operation_id: "run-1", status: "failed", created_at: "2026-07-31T02:00:00Z" },
      { page_id: "page-1", target_panel_id: "panel-1", operation_id: "run-1", status: "running", created_at: "2026-07-31T02:00:01Z" },
      { page_id: "page-1", target_panel_id: "panel-1", operation_id: "run-1", status: "queued", created_at: "2026-07-31T02:00:02Z" },
    ],
  });
  assert.equal(report.pages[0].runningPanelCount, 1);
  assert.equal(report.pages[0].queuedPanelCount, 0);
  assert.equal(report.pages[0].failedPanelCount, 0);
});

test("対象コマのないジョブは全体進捗へ混入させない", () => {
  const report = buildCloudProductionProgress({
    pages: [
      { pageId: "page-1", pageNumber: 1, totalPanelCount: 1, completedPanelCount: 0 },
    ],
    jobs: [
      { page_id: "page-1", target_panel_id: null, status: "running", created_at: "2026-07-31T02:00:00Z" },
    ],
  });
  assert.equal(report.pages[0].status, "not_started");
});
