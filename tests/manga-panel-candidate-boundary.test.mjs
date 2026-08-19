import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  candidateBelongsToPage,
  classifyCandidateLayer,
  filterGenerationJobsForPage,
  hasActivePanelGeneration,
  hasUnresolvedPanelGeneration,
  resolveCandidateTargetPanelId,
} from "../src/modules/manga/domain/panel-candidate.ts";
import {
  applyPanelCandidateAdoption,
  countReversedPanelBackgroundStacks,
  detachRejectedPanelCandidate,
  repairReversedPanelBackgroundStacks,
} from "../src/modules/manga/domain/panel-adoption.ts";

const job = (overrides = {}) => ({
  id: "job-1",
  page_id: "page-1",
  target_panel_id: "panel-db",
  output_asset_id: "asset-1",
  generation_operation: null,
  job_type: "panel_image",
  ...overrides,
});

test("同じコマの生成中または候補確認待ちは古い失敗Jobから重複登録しない", () => {
  const jobs = [
    job({ id: "failed", status: "failed", target_panel_id: "panel-1" }),
    job({ id: "running", status: "running", target_panel_id: "panel-1" }),
    job({ id: "other", status: "queued", target_panel_id: "panel-2" }),
  ];
  assert.equal(hasUnresolvedPanelGeneration(jobs, "panel-1", "failed"), true);
  assert.equal(hasUnresolvedPanelGeneration(jobs, "panel-2", "other"), false);
  assert.equal(
    hasUnresolvedPanelGeneration(
      [
        job({
          id: "pending-review",
          status: "completed",
          target_panel_id: "panel-1",
          panel_adoption_status: "review_required",
        }),
      ],
      "panel-1",
      "failed",
    ),
    true,
  );
  assert.equal(
    hasUnresolvedPanelGeneration(
      [
        job({
          id: "approved",
          status: "completed",
          target_panel_id: "panel-1",
          panel_adoption_status: "auto_placed",
          quality_review_status: "approved",
        }),
      ],
      "panel-1",
      "failed",
    ),
    false,
  );
});

test("失敗候補の再実行は進行中Jobだけを排他して確認待ち候補とは比較を継続できる", () => {
  const jobs = [
    job({ id: "failed-1", status: "failed", target_panel_id: "panel-1" }),
    job({ id: "failed-2", status: "failed", target_panel_id: "panel-1" }),
    job({
      id: "pending-review",
      status: "completed",
      target_panel_id: "panel-1",
      panel_adoption_status: "review_required",
    }),
  ];

  assert.equal(hasActivePanelGeneration(jobs, "panel-1", "failed-1"), false);
  assert.equal(
    hasActivePanelGeneration(
      [...jobs, job({ id: "queued", status: "queued", target_panel_id: "panel-1" })],
      "panel-1",
      "failed-1",
    ),
    true,
  );
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

test("背景候補の採用は旧背景より前面かつ人物より背面へ配置する", () => {
  const canvas = {
    panels: [{ id: "panel-1", imageAssetId: "before" }],
    panelLayers: [
      {
        id: "old-background",
        panelId: "panel-1",
        type: "background",
        orderIndex: 0,
      },
      {
        id: "character",
        panelId: "panel-1",
        type: "character",
        orderIndex: 2,
      },
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
    orderIndex: 1,
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
    [0, 2],
  );
});

test("日時で安全に判定できる逆転背景だけを新しい順が前面になるよう修復する", () => {
  const canvas = {
    panels: [{ id: "panel-1", imageAssetId: "asset-old" }],
    panelLayers: [
      {
        id: "new-background",
        panelId: "panel-1",
        type: "background",
        orderIndex: 0,
        visible: true,
        assetId: "asset-new",
        createdAt: "2026-08-19T02:00:00.000Z",
        updatedAt: "2026-08-19T02:00:00.000Z",
      },
      {
        id: "old-background",
        panelId: "panel-1",
        type: "background",
        orderIndex: 1,
        visible: true,
        assetId: "asset-old",
        createdAt: "2026-08-19T01:00:00.000Z",
        updatedAt: "2026-08-19T01:00:00.000Z",
      },
      {
        id: "effect",
        panelId: "panel-1",
        type: "effect",
        orderIndex: 2,
        visible: true,
        assetId: "asset-effect",
        createdAt: "2026-08-19T03:00:00.000Z",
        updatedAt: "2026-08-19T03:00:00.000Z",
      },
    ],
  };
  assert.equal(countReversedPanelBackgroundStacks(canvas), 1);
  assert.equal(
    repairReversedPanelBackgroundStacks(
      canvas,
      "2026-08-20T00:00:00.000Z",
    ),
    1,
  );
  assert.deepEqual(
    canvas.panelLayers
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((layer) => layer.id),
    ["old-background", "new-background", "effect"],
  );
  assert.equal(canvas.panels[0].imageAssetId, "asset-new");
  assert.equal(countReversedPanelBackgroundStacks(canvas), 0);
});

test("背景日時が欠ける既存Canvasは推測で並べ替えない", () => {
  const canvas = {
    panels: [{ id: "panel-1", imageAssetId: "asset-old" }],
    panelLayers: [
      {
        id: "new-background",
        panelId: "panel-1",
        type: "background",
        orderIndex: 0,
        visible: true,
        assetId: "asset-new",
        createdAt: "",
      },
      {
        id: "old-background",
        panelId: "panel-1",
        type: "background",
        orderIndex: 1,
        visible: true,
        assetId: "asset-old",
        createdAt: "",
      },
    ],
  };
  assert.equal(countReversedPanelBackgroundStacks(canvas), 0);
  assert.equal(
    repairReversedPanelBackgroundStacks(
      canvas,
      "2026-08-20T00:00:00.000Z",
    ),
    0,
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

test("不採用の生成JobはCanvas layerから外して直前の背景へ戻す", () => {
  const canvas = {
    panels: [{ id: "panel-1", imageAssetId: "asset-rejected" }],
    panelLayers: [
      {
        id: "layer-rejected",
        panelId: "panel-1",
        type: "background",
        orderIndex: 0,
        visible: true,
        assetId: "asset-rejected",
        sourceJobId: "job-rejected",
      },
      {
        id: "layer-before",
        panelId: "panel-1",
        type: "background",
        orderIndex: 1,
        visible: true,
        assetId: "asset-before",
        sourceJobId: "job-before",
      },
    ],
  };
  assert.equal(detachRejectedPanelCandidate(canvas, "job-rejected"), true);
  assert.deepEqual(canvas.panelLayers.map((layer) => layer.id), ["layer-before"]);
  assert.equal(canvas.panels[0].imageAssetId, "asset-before");
  assert.equal(detachRejectedPanelCandidate(canvas, "unknown"), false);
});
