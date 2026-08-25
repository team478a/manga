import assert from "node:assert/strict";
import test from "node:test";
import { restorePanelAssetRevision } from "../src/modules/manga/domain/panel-asset-revision.ts";
import { makeTenPanelEditingFixture } from "./fixtures/cloud-panel-editing-ten-panels.mjs";

const snapshot = (value) => structuredClone(value);

test("セリフ本文だけの修正では画像・Job・credit・コマ設計revisionが変わらない", () => {
  const fixture = makeTenPanelEditingFixture();
  const before = snapshot({ panels: fixture.canvas.panels, layers: fixture.canvas.panelLayers, jobs: fixture.generationJobs, credits: fixture.creditReservations, designs: fixture.panelDesigns });
  fixture.canvas.textObjects[4].text = "変更後セリフ5";
  fixture.canvas.textObjects[4].updatedAt = "2026-08-25T01:00:00.000Z";
  assert.deepEqual({ panels: fixture.canvas.panels, layers: fixture.canvas.panelLayers, jobs: fixture.generationJobs, credits: fixture.creditReservations, designs: fixture.panelDesigns }, before);
});

test("1コマだけの画像差し戻しでは他9コマと設計versionを変更せず元Assetも保持する", () => {
  const fixture = makeTenPanelEditingFixture();
  const otherPanelsBefore = snapshot(fixture.canvas.panels.filter((panel) => panel.id !== "panel-5"));
  const otherLayersBefore = snapshot(fixture.canvas.panelLayers.filter((layer) => layer.panelId !== "panel-5"));
  const designsBefore = snapshot(fixture.panelDesigns);
  assert.equal(restorePanelAssetRevision(fixture.canvas, "panel-5", "layer-5-v1", "2026-08-25T01:00:00.000Z"), true);
  assert.equal(fixture.canvas.panels[4].imageAssetId, "asset-5-v1");
  assert.equal(fixture.canvas.panelLayers.filter((layer) => layer.panelId === "panel-5").length, 2);
  assert.deepEqual(fixture.canvas.panels.filter((panel) => panel.id !== "panel-5"), otherPanelsBefore);
  assert.deepEqual(fixture.canvas.panelLayers.filter((layer) => layer.panelId !== "panel-5"), otherLayersBefore);
  assert.deepEqual(fixture.panelDesigns, designsBefore);
});

test("10コマは保存・再読込後も順序、layer、文字組、採用Asset、設計revisionが一致する", () => {
  const fixture = makeTenPanelEditingFixture();
  restorePanelAssetRevision(fixture.canvas, "panel-5", "layer-5-v1", "2026-08-25T01:00:00.000Z");
  fixture.canvas.textObjects[4].text = "保存後セリフ5";
  const reloaded = JSON.parse(JSON.stringify(fixture));
  assert.deepEqual(reloaded, fixture);
  assert.deepEqual(reloaded.panelDesigns.map((item) => [item.design.orderIndex, item.revision]), Array.from({ length: 10 }, (_, index) => [index + 1, 2]));
  assert.equal(reloaded.canvas.panels[4].imageAssetId, "asset-5-v1");
  assert.equal(reloaded.canvas.textObjects[4].fontFamily, "Noto Sans JP");
  assert.equal(reloaded.canvas.textObjects[4].writingMode, "vertical");
});

test("全10コマの生成結果から設計revisionと修正元Assetを追跡できる", () => {
  const fixture = makeTenPanelEditingFixture();
  const revisions = fixture.generationJobs.filter((job) => job.source_asset_id);
  assert.equal(revisions.length, 10);
  assert.equal(revisions.every((job) => job.panelDesignSnapshot.revision === 2), true);
  assert.equal(revisions.every((job) => job.source_asset_id === `asset-${job.panelId.slice(6)}-v1`), true);
});
