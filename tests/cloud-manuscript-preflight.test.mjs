import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCloudManuscript } from "../src/lib/cloud-manuscript-preflight.ts";

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
