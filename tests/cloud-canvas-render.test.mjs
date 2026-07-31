import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { renderCloudCanvasPng } from "../src/lib/cloud-canvas-render.ts";
import { createCloudCanvasSvg } from "../src/lib/cloud-canvas-svg.ts";

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

test("Cloud Canvasは分離レイヤー、コマ形状、吹き出し尻尾を保持する", async () => {
  const timestamp = "2026-07-31T00:00:00.000Z";
  const panel = {
    id: "panel/layered",
    pageId: "page-layered",
    name: "複数レイヤーコマ",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    zIndex: 1,
    visible: true,
    locked: false,
    fillColor: "#ffffff",
    borderColor: "#111111",
    borderWidth: 1,
    shape: "slant_down",
    slant: 0.2,
    imageAssetId: null,
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    imageOpacity: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const layer = (id, type, orderIndex, assetId, opacity = 1) => ({
    id,
    panelId: panel.id,
    name: id,
    type,
    orderIndex,
    visible: true,
    locked: false,
    opacity,
    blendMode: "normal",
    assetId,
    sourceJobId: null,
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const canvas = {
    schemaVersion: 1,
    pageId: "page-layered",
    width: 100,
    height: 100,
    backgroundColor: "#ffffff",
    panels: [panel],
    panelLayers: [
      layer("background", "background", 0, "red"),
      layer("character", "character", 1, "blue", 0.5),
    ],
    balloons: [
      {
        id: "balloon-tail",
        pageId: "page-layered",
        name: "台詞",
        x: 20,
        y: 20,
        width: 40,
        height: 30,
        rotation: 0,
        zIndex: 2,
        visible: true,
        locked: false,
        type: "speech_ellipse",
        fillColor: "#ffffff",
        strokeColor: "#111111",
        strokeWidth: 1,
        opacity: 1,
        tailDirection: "bottom_right",
        tailOffset: 0.5,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    textObjects: [],
  };
  const red = await sharp({
    create: { width: 10, height: 10, channels: 4, background: "#ff0000" },
  })
    .png()
    .toBuffer();
  const blue = await sharp({
    create: { width: 10, height: 10, channels: 4, background: "#0000ff" },
  })
    .png()
    .toBuffer();
  const svg = createCloudCanvasSvg(
    canvas,
    new Map([
      ["red", { href: "data:red", width: 10, height: 10 }],
      ["blue", { href: "data:blue", width: 10, height: 10 }],
    ]),
  );

  assert.ok(svg.indexOf("data:red") < svg.indexOf("data:blue"));
  assert.match(svg, /M 0 0 L 80 0 L 100 100 L 20 100 Z/);
  assert.match(svg, /<polygon points=/);

  const png = await renderCloudCanvasPng(
    canvas,
    new Map([
      ["red", { mimeType: "image/png", bytes: red }],
      ["blue", { mimeType: "image/png", bytes: blue }],
    ]),
  );
  const pixel = await sharp(png).extract({ left: 50, top: 80, width: 1, height: 1 }).raw().toBuffer();
  assert.ok(pixel[0] > 40, `赤レイヤーが失われています: ${pixel[0]}`);
  assert.ok(pixel[2] > 40, `青レイヤーが失われています: ${pixel[2]}`);
});
