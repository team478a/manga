import sharp from "sharp";
import type { ExportImage } from "./index.js";

export const JPEG_EXPORT_FORMAT = "mangai.jpeg-export" as const;
export const JPEG_EXPORT_VERSION = 1 as const;
export const JPEG_EXPORT_QUALITY = 90 as const;
export const JPEG_EXPORT_BACKGROUND = "#ffffff" as const;

export type JpegExportManifest = {
  format: typeof JPEG_EXPORT_FORMAT;
  version: typeof JPEG_EXPORT_VERSION;
  encoder: "sharp";
  quality: typeof JPEG_EXPORT_QUALITY;
  background: typeof JPEG_EXPORT_BACKGROUND;
  chromaSubsampling: "4:4:4";
  files: Array<{
    path: string;
    mimeType: "image/jpeg";
    width: number;
    height: number;
    byteSize: number;
    sha256: string;
  }>;
};

export type JpegExportResult = {
  images: ExportImage[];
  manifest: JpegExportManifest;
  manifestBytes: Uint8Array;
  manifestSha256: string;
};

async function sha256(bytes: Uint8Array) {
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input.buffer);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

function jpegFileName(fileName: string, index: number) {
  const base = fileName.replace(/\.[^.]+$/, "") || String(index + 1).padStart(3, "0");
  return `${base}.jpg`;
}

export async function createJpegExport(
  sources: readonly ExportImage[],
): Promise<JpegExportResult> {
  const images: ExportImage[] = [];
  for (const [index, source] of sources.entries()) {
    if (!Number.isSafeInteger(source.width) || source.width <= 0 ||
        !Number.isSafeInteger(source.height) || source.height <= 0)
      throw new Error("JPEG書き出し画像の寸法が不正です。");
    const output = await sharp(source.bytes, { limitInputPixels: 100_000_000 })
      .flatten({ background: JPEG_EXPORT_BACKGROUND })
      .jpeg({
        quality: JPEG_EXPORT_QUALITY,
        chromaSubsampling: "4:4:4",
        progressive: false,
        mozjpeg: false,
        optimiseCoding: false,
      })
      .toBuffer({ resolveWithObject: true });
    if (output.info.width !== source.width || output.info.height !== source.height)
      throw new Error("JPEG書き出し画像の寸法が一致しません。");
    images.push({
      fileName: jpegFileName(source.fileName, index),
      bytes: new Uint8Array(output.data),
      mimeType: "image/jpeg",
      width: output.info.width,
      height: output.info.height,
    });
  }
  const files: JpegExportManifest["files"] = [];
  for (const image of images) files.push({
    path: image.fileName,
    mimeType: "image/jpeg",
    width: image.width,
    height: image.height,
    byteSize: image.bytes.byteLength,
    sha256: await sha256(image.bytes),
  });
  const manifest: JpegExportManifest = {
    format: JPEG_EXPORT_FORMAT,
    version: JPEG_EXPORT_VERSION,
    encoder: "sharp",
    quality: JPEG_EXPORT_QUALITY,
    background: JPEG_EXPORT_BACKGROUND,
    chromaSubsampling: "4:4:4",
    files,
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  return {
    images,
    manifest,
    manifestBytes,
    manifestSha256: await sha256(manifestBytes),
  };
}
