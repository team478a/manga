import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import {
  createImagesZip,
  createPagesPdf,
} from "../packages/export-core/src/index.ts";

async function makeEightPageImages() {
  return Promise.all(
    Array.from({ length: 8 }, async (_, index) => ({
      fileName: `${String(index + 1).padStart(3, "0")}.png`,
      bytes: new Uint8Array(
        await sharp({
          create: {
            width: 160,
            height: 240,
            channels: 3,
            background: {
              r: 245 - index * 3,
              g: 245 - index * 3,
              b: 245 - index * 3,
            },
          },
        })
          .png()
          .toBuffer(),
      ),
      mimeType: "image/png",
      width: 160,
      height: 240,
    })),
  );
}

test("8ページfixtureを8ページPDFへ順番どおりに出力する", async () => {
  const images = await makeEightPageImages();
  const bytes = await createPagesPdf(images, { dpi: 300 });
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 8);
});

test("8ページfixtureを001〜008の連番PNGとしてまとめる", async () => {
  const images = await makeEightPageImages();
  const bytes = await createImagesZip(images);
  const zip = await JSZip.loadAsync(bytes);
  assert.deepEqual(
    Object.keys(zip.files).sort(),
    Array.from(
      { length: 8 },
      (_, index) => `${String(index + 1).padStart(3, "0")}.png`,
    ),
  );
});

test("Cloud書き出しはページ番号で整列して3桁の連番名を使う", () => {
  const source = fs.readFileSync("src/lib/cloud-canvas-export.ts", "utf8");
  assert.match(source, /page_number - b\.page_number/);
  assert.match(source, /padStart\(3, "0"\)/);
  assert.match(source, /createPagesPdf\(images/);
});
