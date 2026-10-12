import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { createPagesPdf } from "@mangai/export-core";
import { dialogueRectInside, dialogueInnerRegion, dialogueInkFitsTextBox } from "@mangai/canvas-core";
import { createMangaVisualFixture, fixedPanelSvg } from "../apps/desktop/dist-main/main/testing/manga-visual-fixture.js";
import { renderCloudCanvasPng } from "../src/lib/cloud-canvas-render.ts";

const output = path.resolve("work/manga-visual-c3d");
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(path.resolve("output/pdf"), { recursive: true });
const canvases = createMangaVisualFixture();
const assets = new Map();
for (let index = 1; index <= 16; index += 1) {
  const bytes = await sharp(Buffer.from(fixedPanelSvg(index))).png().toBuffer();
  const panel = canvases.flatMap(canvas => canvas.panels)[index - 1];
  assets.set(panel.imageAssetId, { bytes, mimeType: "image/png", width: 720, height: 1080 });
  fs.writeFileSync(path.join(output, `fixture-${index}.png`), bytes);
}
const images = [];
for (const [index, canvas] of canvases.entries()) {
  for (const text of canvas.textObjects) {
    const balloon = canvas.balloons.find(item => item.id === text.parentBalloonId);
    assert.ok(dialogueRectInside({ x: 0, y: 0, width: text.width, height: text.height }, text, dialogueInnerRegion(balloon)));
    assert.ok(dialogueInkFitsTextBox(text));
  }
  const bytes = await renderCloudCanvasPng(canvas, assets);
  fs.writeFileSync(path.join(output, `cloud-${index + 1}.png`), bytes);
  images.push({ fileName: `cloud-${index + 1}.png`, mimeType: "image/png", bytes, width: canvas.width, height: canvas.height });
}
const pdf = await createPagesPdf(images, { dpi: 300 });
assert.equal((await PDFDocument.load(pdf)).getPageCount(), 4);
fs.writeFileSync(path.resolve("output/pdf/mangai-c3d-cloud-fixture.pdf"), pdf);
fs.writeFileSync(path.join(output, "canvas.json"), JSON.stringify(canvases));
console.log("Cloud fixed fixture: 4 pages / 16 distinct image panels; geometry and ruby checks passed.");
