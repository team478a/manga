import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import {
  JPEG_EXPORT_BACKGROUND,
  JPEG_EXPORT_QUALITY,
  createJpegExport,
} from "../packages/export-core/src/jpeg.ts";

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function transparentPng() {
  return new Uint8Array(await sharp({
    create: { width: 4, height: 3, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 0 } },
  }).png().toBuffer());
}

test("P4-E JPEG adapterは固定qualityと白背景でJPGへ変換する", async () => {
  const result = await createJpegExport([{
    fileName: "001.png", bytes: await transparentPng(), mimeType: "image/png", width: 4, height: 3,
  }]);
  assert.equal(JPEG_EXPORT_QUALITY, 90);
  assert.equal(JPEG_EXPORT_BACKGROUND, "#ffffff");
  assert.equal(result.images[0].fileName, "001.jpg");
  assert.equal(result.images[0].mimeType, "image/jpeg");
  const metadata = await sharp(result.images[0].bytes).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 4);
  assert.equal(metadata.height, 3);
  const pixel = await sharp(result.images[0].bytes).raw().toBuffer();
  assert.ok(pixel[0] >= 250 && pixel[1] >= 250 && pixel[2] >= 250);
});

test("同一入力は同一JPEG・manifest・hashを生成する", async () => {
  const source = [{ fileName: "page.png", bytes: await transparentPng(), mimeType: "image/png", width: 4, height: 3 }];
  const first = await createJpegExport(source);
  const second = await createJpegExport(source);
  assert.deepEqual(first.images[0].bytes, second.images[0].bytes);
  assert.deepEqual(first.manifest, second.manifest);
  assert.deepEqual(first.manifestBytes, second.manifestBytes);
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.equal(first.manifest.files[0].sha256, hash(first.images[0].bytes));
  assert.equal(first.manifestSha256, hash(first.manifestBytes));
});

test("manifestは順序・拡張子・MIME・寸法・byte sizeを固定する", async () => {
  const png = await transparentPng();
  const result = await createJpegExport([
    { fileName: "002.png", bytes: png, mimeType: "image/png", width: 4, height: 3 },
    { fileName: "003.webp", bytes: png, mimeType: "image/png", width: 4, height: 3 },
  ]);
  assert.deepEqual(result.manifest.files.map((file) => file.path), ["002.jpg", "003.jpg"]);
  assert.ok(result.manifest.files.every((file) => file.mimeType === "image/jpeg" && file.width === 4 && file.height === 3));
  assert.deepEqual(result.manifest.files.map((file) => file.byteSize), result.images.map((image) => image.bytes.byteLength));
});

test("宣言寸法と実画像寸法の不一致を拒否する", async () => {
  await assert.rejects(
    createJpegExport([{ fileName: "001.png", bytes: await transparentPng(), mimeType: "image/png", width: 5, height: 3 }]),
    /寸法が一致しません/,
  );
});
