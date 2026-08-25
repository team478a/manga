import assert from "node:assert/strict";
import test from "node:test";
import { calculateMangaQualityMetrics } from "../src/modules/manga-quality/application/quality-metrics.ts";
import { inspectionRunSchema } from "../src/modules/manga-quality/domain/inspection-finding.ts";
import { makeQualityInspectionAcceptanceFixture, preparePanelRepair } from "./fixtures/cloud-quality-inspection-acceptance.mjs";

test("P3-F固定fixtureは人数違い・衣装違い・文字切れを対象コマと領域付きで検出する", () => {
  const fixture = makeQualityInspectionAcceptanceFixture();
  const runs = fixture.runs.map((run) => inspectionRunSchema.parse(run));
  const failures = runs.flatMap((run) => run.findings.filter((finding) => finding.status === "FAIL").map((finding) => ({ panelId: run.provenance.panelId, ...finding })));
  assert.deepEqual(failures.map((finding) => finding.category), ["character_count", "costume", "text_layout"]);
  assert.equal(new Set(failures.map((finding) => finding.panelId)).size, 3);
  assert.ok(failures.every((finding) => finding.region !== null));
  assert.ok(runs.every((run) => run.findings.find((finding) => finding.category === "anatomy")?.status === "NOT_EVALUATED"));
});

test("誤判定の修正準備は対象コマだけを選び元Asset・候補・Jobを変更しない", () => {
  const fixture = makeQualityInspectionAcceptanceFixture();
  const target = fixture.panels[2];
  const repair = preparePanelRepair(fixture, target.panelId);
  assert.deepEqual(repair.repairable.map((finding) => finding.category), ["costume"]);
  assert.deepEqual(repair.after, repair.before);
  assert.equal(repair.panelId, target.panelId);
  assert.equal(fixture.panels.filter((panel) => panel.panelId !== target.panelId).length, 5);
  assert.ok(fixture.panels.every((panel) => panel.assetIds.length === 2 && panel.candidateIds.length === 2));
});

test("P3-F KPIは作品単位の採用・再生成・費用・時間・重大不一致・失敗を回帰集計する", () => {
  const fixture = makeQualityInspectionAcceptanceFixture();
  const metrics = calculateMangaQualityMetrics(fixture.qualityRows);
  assert.equal(metrics.initialSelectionRate, 3 / 5);
  assert.equal(metrics.averageRetryCount, 1 / 6);
  assert.equal(metrics.averageCostMicrosPerSelectedPanel, 31000);
  assert.equal(metrics.averageCompletionTimeMs, 1400);
  assert.equal(metrics.majorCharacterMismatchRate, 2 / 6);
  assert.equal(metrics.generationFailureRate, 1 / 6);
});
