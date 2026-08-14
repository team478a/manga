import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  candidateBelongsToPage,
  classifyCandidateLayer,
  filterGenerationJobsForPage,
  resolveCandidateTargetPanelId,
} from "../src/modules/manga/domain/panel-candidate.ts";
import { applyPanelCandidateAdoption } from "../src/modules/manga/domain/panel-adoption.ts";

const job = (overrides = {}) => ({
  id: "job-1",
  page_id: "page-1",
  target_panel_id: "panel-db",
  output_asset_id: "asset-1",
  generation_operation: null,
  job_type: "panel_image",
  ...overrides,
});

const read = (relative) =>
  readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("生成履歴は現在ページのJobだけを表示する", () => {
  const jobs = [
    job({ id: "job-page-1", page_id: "page-1" }),
    job({ id: "job-page-2", page_id: "page-2" }),
    job({ id: "job-project", page_id: null }),
  ];

  assert.deepEqual(
    filterGenerationJobsForPage(jobs, "page-1").map((item) => item.id),
    ["job-page-1"],
  );
  assert.equal(candidateBelongsToPage(jobs[0], "page-1"), true);
  assert.equal(candidateBelongsToPage(jobs[1], "page-1"), false);
  assert.equal(candidateBelongsToPage(jobs[2], "page-1"), false);
});

test("原稿Editorはpage IDをAPIへ渡し別ページ候補を配置前にも拒否する", async () => {
  const [page, api, editor] = await Promise.all([
    read("src/app/creator/[projectId]/pages/[pageId]/page.tsx"),
    read(
      "src/app/creator/[projectId]/pages/[pageId]/services/creator-api.ts",
    ),
    read("src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx"),
  ]);

  assert.match(page, /listCloudGenerationJobs\(projectId, pageId\)/);
  assert.match(api, /new URLSearchParams\(\{ projectId, pageId \}\)/);
  assert.match(editor, /candidateBelongsToPage\(job, page\.id\)/);
  assert.match(editor, /別のページ用のため配置できません/);
  assert.match(
    editor,
    /canvas\.panelLayers\.some\([\s\S]*layer\.sourceJobId === job\.id/,
  );
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
