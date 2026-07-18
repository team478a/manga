import crypto from "node:crypto";
import sharp from "sharp";
import {
  cloudAssetMimeTypeSchema,
  cloudProjectImportSchema,
  type CloudProjectImport,
} from "@mangai/shared";

export const CLOUD_ASSET_BUCKET = "cloud-assets";
export const CLOUD_ASSET_MAX_BYTES = 20 * 1024 * 1024;
export const CLOUD_PROJECT_MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const CLOUD_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const CLOUD_CANVAS_MAX_BYTES = 2 * 1024 * 1024;

export function parseCloudProjectImport(value: unknown): CloudProjectImport {
  const parsed = cloudProjectImportSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "一般向けDesktop Projectのimport情報を検証できません。成人向けまたは不明なProjectはCloudへimportできません。",
    );
  return parsed.data;
}

export function assertOptimisticRevision(
  expectedRevision: number,
  actualRevision: number,
) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error("保存元のrevisionが不正です。");
  if (expectedRevision !== actualRevision)
    throw new Error(
      `保存競合を検出しました。現在のrevisionは${actualRevision}です。再読込してください。`,
    );
}

export function cloudAssetStoragePath(input: {
  profileId: string;
  projectId: string;
  assetId: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
}) {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (
    !uuid.test(input.profileId) ||
    !uuid.test(input.projectId) ||
    !uuid.test(input.assetId)
  )
    throw new Error("Cloud Assetの保存先IDが不正です。");
  const mimeType = cloudAssetMimeTypeSchema.parse(input.mimeType);
  const extension =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/jpeg"
        ? "jpg"
        : "webp";
  return `${input.profileId}/${input.projectId}/${input.assetId}.${extension}`;
}

export async function validateCloudAssetBytes(input: {
  bytes: Uint8Array;
  declaredMimeType: unknown;
}) {
  const mimeType = cloudAssetMimeTypeSchema.parse(input.declaredMimeType);
  if (!input.bytes.byteLength || input.bytes.byteLength > CLOUD_ASSET_MAX_BYTES)
    throw new Error("画像は1byte以上20MB以下にしてください。");
  const image = sharp(input.bytes, {
    failOn: "error",
    limitInputPixels: 100_000_000,
  });
  const metadata = await image.metadata();
  const actualMimeType =
    metadata.format === "png"
      ? "image/png"
      : metadata.format === "jpeg"
        ? "image/jpeg"
        : metadata.format === "webp"
          ? "image/webp"
          : null;
  if (actualMimeType !== mimeType)
    throw new Error("画像の宣言形式と実データが一致しません。");
  if (!metadata.width || !metadata.height)
    throw new Error("画像寸法を検証できません。");
  if (metadata.width > 20_000 || metadata.height > 20_000)
    throw new Error("画像の幅と高さは20,000px以下にしてください。");
  await image.clone().rotate().toBuffer();
  return {
    mimeType,
    byteSize: input.bytes.byteLength,
    width: metadata.width,
    height: metadata.height,
    sha256: crypto.createHash("sha256").update(input.bytes).digest("hex"),
  } as const;
}

export function sumCloudAssetBytes(
  assets: Array<{ byteSize: number; deletedAt?: string | null }>,
) {
  return assets.reduce(
    (total, asset) => total + (asset.deletedAt ? 0 : asset.byteSize),
    0,
  );
}
