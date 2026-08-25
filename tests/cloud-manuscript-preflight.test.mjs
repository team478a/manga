import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCloudManuscript } from "../src/lib/cloud-manuscript-preflight.ts";
import { createCompletionModeProfile } from "../packages/shared/src/index.ts";

function makePage(index) {
  const pageId = `page-${index}`;
  const panelId = `panel-${index}`;
  const assetId = `asset-${index}`;
  return {
    id: pageId,
    page_number: index,
    canvas: {
      schemaVersion: 1,
      pageId,
      width: 1600,
      height: 2400,
      backgroundColor: "#ffffff",
      panels: [
        {
          id: panelId,
          pageId,
          name: "コマ1",
          x: 100,
          y: 100,
          width: 1200,
          height: 900,
          rotation: 0,
          zIndex: 0,
          visible: true,
          locked: false,
          borderColor: "#111111",
          borderWidth: 4,
          fillColor: "#ffffff",
          shape: "rectangle",
          slant: 0,
          imageAssetId: assetId,
          imageFit: "cover",
          imageOffsetX: 0,
          imageOffsetY: 0,
          imageScale: 1,
          imageRotation: 0,
          imageOpacity: 1,
          createdAt: "",
          updatedAt: "",
        },
      ],
      panelLayers: [
        {
          id: `layer-${index}`,
          panelId,
          name: "背景",
          type: "background",
          orderIndex: 0,
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: "normal",
          assetId,
          sourceJobId: null,
          imageFit: "cover",
          imageOffsetX: 0,
          imageOffsetY: 0,
          imageScale: 1,
          imageRotation: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
      balloons: [],
      textObjects: [],
    },
  };
}

function makeEightPageManuscript() {
  const pages = Array.from({ length: 8 }, (_, index) => makePage(index + 1));
  const assets = pages.map((_, index) => ({
    id: `asset-${index + 1}`,
    width: 1600,
    height: 1200,
  }));
  return { pages, assets };
}

test("8ページ全コマに画像があれば完成原稿として判定する", () => {
  const fixture = makeEightPageManuscript();
  const report = analyzeCloudManuscript({
    coverPageId: fixture.pages[0].id,
    ...fixture,
  });
  assert.equal(report.ready, true);
  assert.equal(report.pageCount, 8);
  assert.equal(report.completedPanelCount, 8);
  assert.equal(report.totalPanelCount, 8);
  assert.equal(report.errorCount, 0);
  assert.equal(report.pageProgress.length, 8);
  assert.deepEqual(report.pageProgress[0], {
    pageId: "page-1",
    pageNumber: 1,
    totalPanelCount: 1,
    completedPanelCount: 1,
  });
});

test("表紙・順番・空コマ・素材・解像度・文字overflowをまとめて検出する", () => {
  const fixture = makeEightPageManuscript();
  fixture.pages[1].page_number = 4;
  fixture.pages[0].canvas.panelLayers = [];
  fixture.pages[0].canvas.panels[0].imageAssetId = null;
  fixture.pages[2].canvas.panelLayers[0].assetId = "missing";
  fixture.assets[3] = { id: "asset-4", width: 320, height: 240 };
  fixture.pages[4].canvas.textObjects.push({
    id: "overflow-text",
    pageId: fixture.pages[4].id,
    parentBalloonId: null,
    name: "長いセリフ",
    text: "長いセリフ".repeat(100),
    writingMode: "vertical",
    x: 0,
    y: 0,
    width: 80,
    height: 80,
    rotation: 0,
    zIndex: 1,
    visible: true,
    locked: false,
    fontFamily: "sans-serif",
    fontSize: 40,
    fontWeight: 400,
    color: "#111111",
    textAlign: "start",
    verticalAlign: "top",
    lineHeight: 1.5,
    letterSpacing: 0,
    padding: 4,
    opacity: 1,
    createdAt: "",
    updatedAt: "",
  });
  const report = analyzeCloudManuscript({ coverPageId: null, ...fixture });
  assert.equal(report.ready, false);
  const codes = new Set(report.issues.map((issue) => issue.code));
  for (const code of [
    "cover_missing",
    "page_order",
    "empty_panel",
    "missing_asset",
    "low_resolution",
    "text_overflow",
  ]) {
    assert.ok(codes.has(code), `${code} should be reported`);
  }
});

test("大量の修正項目は上限を設け、残件数を保持する", () => {
  const pages = Array.from({ length: 8 }, (_, index) => {
    const page = makePage(index + 1);
    page.canvas.panelLayers = [];
    page.canvas.panels[0].imageAssetId = null;
    return page;
  });
  const report = analyzeCloudManuscript({
    coverPageId: null,
    pages,
    assets: [],
    issueLimit: 3,
  });
  assert.equal(report.issues.length, 3);
  assert.equal(report.truncatedIssueCount, 6);
});

test("短い縦書きが複数列へ割れた原稿は販売準備を停止する", () => {
  const fixture = makeEightPageManuscript();
  fixture.pages[0].canvas.balloons.push({
    id: "balloon-1",
    pageId: fixture.pages[0].id,
  });
  fixture.pages[0].canvas.textObjects.push({
    id: "short-text",
    pageId: fixture.pages[0].id,
    parentBalloonId: "balloon-1",
    name: "短いセリフ",
    text: "証拠を",
    writingMode: "vertical",
    x: 0,
    y: 0,
    width: 120,
    height: 70,
    rotation: 0,
    zIndex: 1,
    visible: true,
    locked: false,
    fontFamily: "sans-serif",
    fontSize: 32,
    fontWeight: 400,
    color: "#111111",
    textAlign: "start",
    verticalAlign: "top",
    lineHeight: 1.2,
    letterSpacing: 0,
    padding: 0,
    opacity: 1,
    createdAt: "",
    updatedAt: "",
  });
  const report = analyzeCloudManuscript({
    coverPageId: fixture.pages[0].id,
    ...fixture,
  });
  assert.equal(report.ready, false);
  assert.ok(report.issues.some((issue) => issue.code === "text_layout"));
});

test("永続書き出し前に未確定・stale・生成中ページを拒否する", () => {
  const fixture = makeEightPageManuscript();
  const productionStates = fixture.pages.map((page) => ({
    pageId: page.id,
    status: "finalized",
    isStale: false,
  }));
  productionStates[1].status = "review_required";
  productionStates[2].isStale = true;
  const report = analyzeCloudManuscript({
    coverPageId: fixture.pages[0].id,
    ...fixture,
    productionStates,
    activeGenerationPageIds: [fixture.pages[3].id],
    requireFinalizedPages: true,
  });
  assert.equal(report.ready, false);
  const codes = new Set(report.issues.map((issue) => issue.code));
  assert.ok(codes.has("page_not_finalized"));
  assert.ok(codes.has("page_stale"));
  assert.ok(codes.has("generation_active"));
});

test("P4-Cはmode別コマ数とセリフ量をwarningに留める", () => {
  const fixture = makeEightPageManuscript();
  fixture.pages[0].canvas.panels = Array.from({ length: 7 }, (_, index) => ({
    ...fixture.pages[0].canvas.panels[0], id: `kindle-panel-${index}`,
  }));
  fixture.pages[0].canvas.textObjects.push({
    id: "long-dialogue", pageId: fixture.pages[0].id, parentBalloonId: null,
    name: "長いセリフ", text: "あ".repeat(121), writingMode: "horizontal",
    x: 0, y: 0, width: 1500, height: 500, rotation: 0, zIndex: 1,
    visible: true, locked: false, fontFamily: "sans-serif", fontSize: 20,
    fontWeight: 400, color: "#111111", textAlign: "start", verticalAlign: "top",
    lineHeight: 1.2, letterSpacing: 0, padding: 0, opacity: 1, createdAt: "", updatedAt: "",
  });
  const report = analyzeCloudManuscript({
    coverPageId: fixture.pages[0].id, ...fixture,
    completionModeProfile: createCompletionModeProfile("kindle_explainer", "cloud_general"),
    qualityFindings: [], qualityFindingsAvailable: true,
  });
  assert.equal(report.ready, true);
  assert.equal(report.completionMode, "kindle_explainer");
  assert.ok(report.issues.some((issue) => issue.code === "mode_panel_count" && issue.severity === "warning"));
  assert.ok(report.issues.some((issue) => issue.code === "mode_dialogue_length" && issue.severity === "warning"));
});

test("P4-Cは最新P3 findingをread-only判定しFAILだけをerrorにする", () => {
  const fixture = makeEightPageManuscript();
  const report = analyzeCloudManuscript({
    coverPageId: fixture.pages[0].id, ...fixture,
    completionModeProfile: createCompletionModeProfile("longform_story", "cloud_general"),
    qualityFindingsAvailable: true,
    qualityFindings: [
      { status: "PASS", reason: "人数一致", pageId: fixture.pages[0].id, panelId: "panel-1" },
      { status: "WARNING", reason: "衣装を確認", pageId: fixture.pages[1].id, panelId: "panel-2" },
      { status: "NOT_EVALUATED", reason: "視覚検査未実行", pageId: fixture.pages[2].id, panelId: "panel-3" },
      { status: "FAIL", reason: "文字切れ", pageId: fixture.pages[3].id, panelId: "panel-4" },
    ],
  });
  assert.equal(report.ready, false);
  assert.equal(report.errorCount, 1);
  assert.ok(report.issues.some((issue) => issue.message.includes("文字切れ") && issue.severity === "error"));
  assert.ok(report.issues.some((issue) => issue.code === "quality_not_evaluated" && issue.severity === "warning"));
});

test("mode未設定ProjectはP4 guidanceを推測せず従来preflightを維持する", () => {
  const fixture = makeEightPageManuscript();
  const report = analyzeCloudManuscript({ coverPageId: fixture.pages[0].id, ...fixture });
  assert.equal(report.completionMode, null);
  assert.equal(report.issues.some((issue) => issue.code.startsWith("mode_") || issue.code.startsWith("quality_")), false);
});
