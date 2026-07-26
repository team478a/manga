import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCanvasSvg } from "../src/app/creator/[projectId]/pages/[pageId]/services/canvas-svg.ts";
import {
  createCanvasHistoryStore,
  recordCanvasSnapshot,
  takeCanvasRedo,
  takeCanvasUndo,
} from "../src/app/creator/[projectId]/pages/[pageId]/hooks/useCanvasHistory.ts";

function canvasWithColor(backgroundColor) {
  return {
    schemaVersion: 1,
    pageId: "page-1",
    width: 320,
    height: 480,
    backgroundColor,
    panels: [],
    panelLayers: [],
    balloons: [],
    textObjects: [],
    updatedAt: "2026-07-24T00:00:00.000Z",
  };
}

test("Canvas SVG生成は入力を変更せずXMLをescapeする", () => {
  const canvas = {
    ...canvasWithColor("#ffffff"),
    textObjects: [
      {
        id: "text-1",
        pageId: "page-1",
        text: "<script>alert('x')</script> & 本文",
        writingMode: "horizontal",
        x: 10,
        y: 20,
        width: 200,
        height: 80,
        rotation: 0,
        zIndex: 1,
        visible: true,
        locked: false,
        fontFamily: '"Comic" & Sans',
        fontSize: 24,
        fontWeight: 400,
        color: "#111111",
        lineHeight: 1.5,
        letterSpacing: 0,
        padding: 4,
        opacity: 1,
      },
    ],
  };
  const before = structuredClone(canvas);
  const svg = createCanvasSvg(canvas, new Map());

  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /&amp; 本文/);
  assert.doesNotMatch(svg, /<script>/);
  assert.deepEqual(canvas, before);
});

test("Canvas履歴はUndo/Redoし、新規変更時にRedoを破棄する", () => {
  const white = canvasWithColor("#ffffff");
  const red = canvasWithColor("#ff0000");
  const blue = canvasWithColor("#0000ff");
  const history = createCanvasHistoryStore();

  recordCanvasSnapshot(history, white);
  assert.deepEqual(takeCanvasUndo(history, red), white);
  assert.deepEqual(takeCanvasRedo(history, white), red);

  assert.deepEqual(takeCanvasUndo(history, red), white);
  recordCanvasSnapshot(history, blue);
  assert.equal(takeCanvasRedo(history, blue), null);
});

test("Editor UIはAPI URLを組み立てず分離サービスを利用する", async () => {
  const source = await readFile(
    new URL(
      "../src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /["'`]\/api\/creator\//);
  assert.match(source, /useCanvasAutosave/);
  assert.match(source, /useCanvasHistory/);
  assert.match(source, /useCanvasPointer/);
});
