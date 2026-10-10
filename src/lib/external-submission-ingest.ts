import crypto from "node:crypto";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import JSZip from "jszip";
import sharp from "sharp";

export const EXTERNAL_SUBMISSION_MAX_SOURCE_BYTES = 50 * 1024 * 1024;
export const EXTERNAL_SUBMISSION_MAX_EXPANDED_BYTES = 500 * 1024 * 1024;
export const EXTERNAL_SUBMISSION_MAX_PAGES = 100;
export const EXTERNAL_SUBMISSION_MAX_PAGE_BYTES = 20 * 1024 * 1024;
export const EXTERNAL_SUBMISSION_MAX_PIXELS = 80_000_000;
export const EXTERNAL_SUBMISSION_MAX_ZIP_RATIO = 100;

export type ExternalSubmissionSourceFormat = "pdf" | "zip" | "images";

export type ExternalSubmissionMalwareScanner = (input: {
  bytes: Uint8Array;
  fileName: string;
  sha256: string;
}) => Promise<"clean" | "infected" | "unavailable">;

export type ValidatedExternalSubmissionPage = {
  position: number;
  sourceName: string;
  bytes: Uint8Array;
  mimeType: "image/png";
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
};

export class ExternalSubmissionIngestError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "ExternalSubmissionIngestError";
  }
}

function fail(code: string): never {
  throw new ExternalSubmissionIngestError(code);
}

function sha256(bytes: Uint8Array) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]) {
  return prefix.every((value, index) => bytes[index] === value);
}

function assertSourceSize(bytes: Uint8Array) {
  if (!bytes.byteLength || bytes.byteLength > EXTERNAL_SUBMISSION_MAX_SOURCE_BYTES)
    fail("source_size_invalid");
}

function assertSafeArchivePath(name: string) {
  if (
    !name ||
    name.length > 500 ||
    name.includes("\\") ||
    name.startsWith("/") ||
    /^[a-zA-Z]:/.test(name) ||
    name.split("/").some((part) => part === ".." || part === ".")
  )
    fail("zip_path_unsafe");
}

async function validatePageImage(
  sourceName: string,
  bytes: Uint8Array,
  position: number,
): Promise<ValidatedExternalSubmissionPage> {
  if (!bytes.byteLength || bytes.byteLength > EXTERNAL_SUBMISSION_MAX_PAGE_BYTES)
    fail("page_size_invalid");
  const image = sharp(bytes, {
    failOn: "warning",
    limitInputPixels: EXTERNAL_SUBMISSION_MAX_PIXELS,
  });
  let metadata;
  try {
    metadata = await image.metadata();
  } catch {
    fail("image_invalid");
  }
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > 20_000 ||
    metadata.height > 20_000 ||
    metadata.width * metadata.height > EXTERNAL_SUBMISSION_MAX_PIXELS ||
    !["jpeg", "png", "webp"].includes(metadata.format ?? "")
  )
    fail("image_dimensions_invalid");

  // Normalize orientation and strip metadata before the page leaves quarantine.
  const normalized = await image.rotate().png({ compressionLevel: 9 }).toBuffer();
  if (normalized.byteLength > EXTERNAL_SUBMISSION_MAX_PAGE_BYTES)
    fail("normalized_page_too_large");
  const normalizedMetadata = await sharp(normalized).metadata();
  if (!normalizedMetadata.width || !normalizedMetadata.height)
    fail("image_invalid");
  return {
    position,
    sourceName,
    bytes: normalized,
    mimeType: "image/png",
    byteSize: normalized.byteLength,
    width: normalizedMetadata.width,
    height: normalizedMetadata.height,
    sha256: sha256(normalized),
  };
}

async function renderPdfPages(bytes: Uint8Array) {
  Object.assign(globalThis, {
    DOMMatrix: globalThis.DOMMatrix ?? DOMMatrix,
    ImageData: globalThis.ImageData ?? ImageData,
    Path2D: globalThis.Path2D ?? Path2D,
  });
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  let document;
  try {
    document = await getDocument({
      data: bytes.slice(),
      disableFontFace: true,
      isEvalSupported: false,
      useSystemFonts: false,
      verbosity: 0,
    }).promise;
  } catch {
    fail("pdf_invalid_or_encrypted");
  }
  if (!document.numPages || document.numPages > EXTERNAL_SUBMISSION_MAX_PAGES)
    fail("page_count_invalid");

  const pages: ValidatedExternalSubmissionPage[] = [];
  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 4096 / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      if (viewport.width * viewport.height > EXTERNAL_SUBMISSION_MAX_PIXELS)
        fail("image_dimensions_invalid");
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      await page.render({
        canvas: canvas as never,
        canvasContext: context as never,
        viewport,
      }).promise;
      const rendered = canvas.toBuffer("image/png");
      pages.push(await validatePageImage(`page-${index}.png`, rendered, index));
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
  return pages;
}

async function extractZipPages(bytes: Uint8Array) {
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(bytes, { checkCRC32: true, createFolders: false });
  } catch {
    fail("zip_invalid");
  }
  const entries = Object.values(archive.files).filter((entry) => !entry.dir);
  if (!entries.length || entries.length > EXTERNAL_SUBMISSION_MAX_PAGES)
    fail("page_count_invalid");
  const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  entries.sort((left, right) => collator.compare(left.name, right.name));

  const pages: ValidatedExternalSubmissionPage[] = [];
  let expandedBytes = 0;
  for (const [index, entry] of entries.entries()) {
    const originalName = (entry as unknown as { unsafeOriginalName?: string })
      .unsafeOriginalName;
    if (originalName) assertSafeArchivePath(originalName);
    assertSafeArchivePath(entry.name);
    if (!/\.(?:jpe?g|png|webp)$/i.test(entry.name)) fail("zip_entry_type_invalid");
    const pageBytes = await entry.async("uint8array");
    expandedBytes += pageBytes.byteLength;
    if (expandedBytes > EXTERNAL_SUBMISSION_MAX_EXPANDED_BYTES)
      fail("zip_expanded_size_exceeded");
    const compressedSize = Number(
      (entry as unknown as { _data?: { compressedSize?: number } })._data?.compressedSize,
    );
    if (
      Number.isFinite(compressedSize) &&
      compressedSize > 0 &&
      pageBytes.byteLength / compressedSize > EXTERNAL_SUBMISSION_MAX_ZIP_RATIO
    )
      fail("zip_compression_ratio_exceeded");
    pages.push(await validatePageImage(entry.name, pageBytes, index + 1));
  }
  return pages;
}

export async function validateExternalSubmissionSource(input: {
  format: ExternalSubmissionSourceFormat;
  bytes: Uint8Array;
  fileName: string;
  scan: ExternalSubmissionMalwareScanner;
}) {
  assertSourceSize(input.bytes);
  const sourceSha256 = sha256(input.bytes);
  const scanStatus = await input.scan({
    bytes: input.bytes,
    fileName: input.fileName,
    sha256: sourceSha256,
  });
  if (scanStatus === "infected") fail("malware_detected");
  if (scanStatus !== "clean") fail("malware_scan_unavailable");

  let pages: ValidatedExternalSubmissionPage[];
  if (input.format === "pdf") {
    if (!hasPrefix(input.bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
      fail("pdf_magic_invalid");
    pages = await renderPdfPages(input.bytes);
  } else if (input.format === "zip") {
    if (
      !hasPrefix(input.bytes, [0x50, 0x4b, 0x03, 0x04]) &&
      !hasPrefix(input.bytes, [0x50, 0x4b, 0x05, 0x06])
    )
      fail("zip_magic_invalid");
    pages = await extractZipPages(input.bytes);
  } else {
    pages = [await validatePageImage(input.fileName, input.bytes, 1)];
  }

  if (!pages.length || pages.length > EXTERNAL_SUBMISSION_MAX_PAGES)
    fail("page_count_invalid");
  const hashes = new Set<string>();
  for (const page of pages) {
    if (hashes.has(page.sha256)) fail("duplicate_page");
    hashes.add(page.sha256);
  }
  return { sourceSha256, scanStatus: "clean" as const, pages };
}
