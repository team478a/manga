import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyCandidateLayer,
  resolveCandidateTargetPanelId,
} from "../src/modules/manga/domain/panel-candidate.ts";
import { applyPanelCandidateAdoption } from "../src/modules/manga/domain/panel-adoption.ts";

const job = (overrides = {}) => ({
  id: "job-1",
  target_panel_id: "panel-db",
  output_asset_id: "asset-1",
  generation_operation: null,
  job_type: "panel_image",
  ...overrides,
});

test("候補の対象コマは受付時、DB、現在選択の順で解決する", () => {
  assert.equal(
    resolveCandidateTargetPanelId({
      job: job(),
      generationTargets: { "job-1": "panel-request" },
      selectedPanelId: "panel-selected",
    }),
    "panel-request",
  );
  assert.equal(
    resolveCandidateTargetPanelId({
      job: job(),
      generationTargets: {},
      selectedPanelId: "panel-selected",
    }),
    "panel-db",
  );
  assert.equal(
    resolveCandidateTargetPanelId({
      job: job({ target_panel_id: null }),
      generationTargets: {},
      selectedPanelId: "panel-selected",
    }),
    "panel-selected",
  );
});

test("修正と分離生成の候補を既存Canvas layer typeへ分類する", () => {
  assert.equal(
    classifyCandidateLayer(job({ generation_operation: "inpainting" })),
    "correction",
  );
  assert.equal(
    classifyCandidateLayer(job({ job_type: "character_base" })),
    "character",
  );
  assert.equal(classifyCandidateLayer(job({ job_type: "prop" })), "prop");
  assert.equal(classifyCandidateLayer(job({ job_type: "effect" })), "effect");
  assert.equal(classifyCandidateLayer(job()), "background");
});

test("背景候補の採用はpanel imageと最背面layerを同じ値で更新する", () => {
  const canvas = {
    panels: [{ id: "panel-1", imageAssetId: "before" }],
    panelLayers: [
      { panelId: "panel-1", orderIndex: 0 },
      { panelId: "panel-1", orderIndex: 2 },
    ],
  };
  assert.equal(
    applyPanelCandidateAdoption(canvas, {
      assetId: "asset-after",
      layerId: "layer-after",
      layerType: "background",
      sourceJobId: "job-1",
      targetPanelId: "panel-1",
      timestamp: "2026-08-05T00:00:00.000Z",
    }),
    true,
  );
  assert.equal(canvas.panels[0].imageAssetId, "asset-after");
  assert.deepEqual(canvas.panelLayers.at(-1), {
    id: "layer-after",
    panelId: "panel-1",
    name: "AI背景レイヤー",
    type: "background",
    orderIndex: 0,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    assetId: "asset-after",
    sourceJobId: "job-1",
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  });
  assert.deepEqual(
    canvas.panelLayers.slice(0, 2).map((layer) => layer.orderIndex),
    [1, 2],
  );
});

test("透明人物候補はpanel imageを置換せず最前面multiply layerへ採用する", () => {
  const canvas = {
    panels: [{ id: "panel-1", imageAssetId: "background" }],
    panelLayers: [{ panelId: "panel-1", orderIndex: 4 }],
  };
  applyPanelCandidateAdoption(canvas, {
    assetId: "character",
    layerId: "character-layer",
    layerType: "character",
    sourceJobId: "job-2",
    targetPanelId: "panel-1",
    timestamp: "2026-08-05T00:00:00.000Z",
  });
  assert.equal(canvas.panels[0].imageAssetId, "background");
  assert.equal(canvas.panelLayers.at(-1).orderIndex, 5);
  assert.equal(canvas.panelLayers.at(-1).blendMode, "multiply");
});
