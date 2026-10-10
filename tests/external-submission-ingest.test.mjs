import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, rgb } from "pdf-lib";
import JSZip from "jszip";
import sharp from "sharp";
import {
  ExternalSubmissionIngestError,
  validateExternalSubmissionSource,
} from "../src/lib/external-submission-ingest.ts";

const clean = async () => "clean";

async function image(color = { r: 12, g: 34, b: 56 }) {
  return new Uint8Array(
    await sharp({ create: { width: 32, height: 48, channels: 3, background: color } })
      .jpeg()
      .toBuffer(),
  );
}

test("normalizes an image and records immutable page metadata", async () => {
  const result = await validateExternalSubmissionSource({
    format: "images",
    bytes: await image(),
    fileName: "page-1.jpg",
    scan: clean,
  });
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].mimeType, "image/png");
  assert.equal(result.pages[0].width, 32);
  assert.equal(result.pages[0].height, 48);
  assert.match(result.pages[0].sha256, /^[a-f0-9]{64}$/);
});

test("sorts ZIP image entries naturally and rejects traversal", async () => {
  const zip = new JSZip();
  zip.file("pages/10.jpg", await image({ r: 10, g: 0, b: 0 }));
  zip.file("pages/2.jpg", await image({ r: 2, g: 0, b: 0 }));
  const result = await validateExternalSubmissionSource({
    format: "zip",
    bytes: await zip.generateAsync({ type: "uint8array" }),
    fileName: "pages.zip",
    scan: clean,
  });
  assert.deepEqual(result.pages.map((page) => page.sourceName), ["pages/2.jpg", "pages/10.jpg"]);

  const unsafe = new JSZip();
  unsafe.file("../page.jpg", await image());
  await assert.rejects(
    validateExternalSubmissionSource({
      format: "zip",
      bytes: await unsafe.generateAsync({ type: "uint8array" }),
      fileName: "unsafe.zip",
      scan: clean,
    }),
    (error) => error instanceof ExternalSubmissionIngestError && error.code === "zip_path_unsafe",
  );
});

test("renders PDF pages to normalized PNG pages", async () => {
  const pdf = await PDFDocument.create();
  for (const color of [rgb(1, 0, 0), rgb(0, 0, 1)]) {
    const page = pdf.addPage([72, 96]);
    page.drawRectangle({ x: 0, y: 0, width: 72, height: 96, color });
  }
  const result = await validateExternalSubmissionSource({
    format: "pdf",
    bytes: new Uint8Array(await pdf.save()),
    fileName: "book.pdf",
    scan: clean,
  });
  assert.equal(result.pages.length, 2);
  assert.deepEqual(result.pages.map((page) => page.position), [1, 2]);
  assert.ok(result.pages.every((page) => page.width > 0 && page.height > 0));
});

test("fails closed when malware scanning is unavailable", async () => {
  await assert.rejects(
    validateExternalSubmissionSource({
      format: "images",
      bytes: await image(),
      fileName: "page.jpg",
      scan: async () => "unavailable",
    }),
    (error) =>
      error instanceof ExternalSubmissionIngestError &&
      error.code === "malware_scan_unavailable",
  );
});

test("rejects spoofed magic bytes and duplicate ZIP pages", async () => {
  await assert.rejects(
    validateExternalSubmissionSource({
      format: "pdf",
      bytes: await image(),
      fileName: "fake.pdf",
      scan: clean,
    }),
    (error) => error instanceof ExternalSubmissionIngestError && error.code === "pdf_magic_invalid",
  );

  const duplicate = await image();
  const zip = new JSZip();
  zip.file("1.jpg", duplicate);
  zip.file("2.jpg", duplicate);
  await assert.rejects(
    validateExternalSubmissionSource({
      format: "zip",
      bytes: await zip.generateAsync({ type: "uint8array" }),
      fileName: "duplicate.zip",
      scan: clean,
    }),
    (error) => error instanceof ExternalSubmissionIngestError && error.code === "duplicate_page",
  );
});
