import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { createPagesPdf } from "../packages/export-core/dist/index.js";
import { renderCloudCanvasPng } from "../src/lib/cloud-canvas-render.ts";
import { createFourPageCompletionFixture } from "../tests/fixtures/manga-page-completion-four-page.mjs";

const output = path.resolve(".artifacts/r4-2c");
const evidence = path.resolve("docs/evidence/R4_2C_FOUR_PAGE_PREVIEW.png");
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(path.dirname(evidence), { recursive: true });
const pages = createFourPageCompletionFixture();
const images = [];
const hashes = [];

for (const page of pages) {
  const assets = new Map();
  for (const [index, id] of page.assetIds.entries()) {
    const bytes = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 4,
        background: index ? "#315ca8" : "#b13c35",
      },
    }).png().toBuffer();
    assets.set(id, { mimeType: "image/png", bytes: new Uint8Array(bytes) });
  }
  const bytes = await renderCloudCanvasPng(page.canvas, assets);
  const fileName = `${String(page.pageNumber).padStart(3, "0")}.png`;
  fs.writeFileSync(path.join(output, fileName), bytes);
  hashes.push({ fileName, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
  images.push({ fileName, bytes, mimeType: "image/png", width: page.width, height: page.height });
}

const pdf = await createPagesPdf(images, { dpi: 300 });
const pdfPath = path.join(output, "four-page-manuscript.pdf");
fs.writeFileSync(pdfPath, pdf);
const parsedPdf = await PDFDocument.load(pdf);
if (parsedPdf.getPageCount() !== 4) throw new Error("fixture_pdf_page_count_invalid");

const thumbnails = await Promise.all(images.map((image) => sharp(Buffer.from(image.bytes)).resize({ width: 200, height: 300, fit: "contain", background: "white" }).png().toBuffer()));
const header = Buffer.from(`<svg width="900" height="90" xmlns="http://www.w3.org/2000/svg"><rect width="900" height="90" fill="#fafaf9"/><text x="30" y="38" font-family="sans-serif" font-size="25" font-weight="700" fill="#1c1917">MANGAI PR-R4-2C — 4-page manuscript fixture</text><text x="30" y="68" font-family="sans-serif" font-size="16" fill="#57534e">Canvas → PNG → PDF / 4 of 4 pages complete</text></svg>`);
await sharp({ create: { width: 900, height: 450, channels: 4, background: "#e7e5e4" } })
  .composite([
    { input: header, left: 0, top: 0 },
    ...thumbnails.map((input, index) => ({ input, left: 25 + index * 215, top: 115 })),
  ])
  .png()
  .toFile(evidence);

process.stdout.write(`${JSON.stringify({
  pages: hashes,
  pdf: { pageCount: parsedPdf.getPageCount(), byteSize: pdf.byteLength, sha256: crypto.createHash("sha256").update(pdf).digest("hex") },
  preview: { path: evidence, sha256: crypto.createHash("sha256").update(fs.readFileSync(evidence)).digest("hex") },
}, null, 2)}\n`);
