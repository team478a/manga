import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { renderCloudCanvasPng } from "../src/lib/cloud-canvas-render.ts";

test("Cloud CanvasをPNGへ描画できる", async () => {
  const canvas = {
    schemaVersion: 1,
    pageId: "page-1",
    width: 320,
    height: 480,
    backgroundColor: "#fffaf0",
    panels: [
      {
        id: "panel-1",
        pageId: "page-1",
        x: 20,
        y: 20,
        width: 280,
        height: 260,
        rotation: 0,
        zIndex: 1,
        visible: true,
        locked: false,
        fillColor: "#22c55e",
        borderColor: "#111827",
        borderWidth: 4,
        imageAssetId: null,
        imageOpacity: 1,
      },
    ],
    panelLayers: [],
    balloons: [
      {
        id: "balloon-1",
        pageId: "page-1",
        x: 60,
        y: 70,
        width: 160,
        height: 100,
        rotation: 0,
        zIndex: 2,
        visible: true,
        locked: false,
        type: "speech_ellipse",
        fillColor: "#ffffff",
        strokeColor: "#111827",
        strokeWidth: 3,
        opacity: 1,
      },
    ],
    textObjects: [
      {
        id: "text-1",
        pageId: "page-1",
        balloonId: "balloon-1",
        text: "縦書きテスト",
        x: 105,
        y: 80,
        width: 70,
        height: 80,
        rotation: 0,
        zIndex: 3,
        visible: true,
        locked: false,
        writingMode: "vertical",
        fontFamily: "sans-serif",
        fontSize: 22,
        fontWeight: 500,
        color: "#111827",
        textAlign: "start",
        lineHeight: 1.4,
        letterSpacing: 0,
        padding: 4,
        opacity: 1,
      },
    ],
    updatedAt: "2026-07-18T00:00:00.000Z",
  };

  const png = await renderCloudCanvasPng(canvas, new Map());
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 320);
  assert.equal(metadata.height, 480);
});
