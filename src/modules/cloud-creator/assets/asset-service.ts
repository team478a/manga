import crypto from "node:crypto";
import {
  CLOUD_ASSET_BUCKET,
  CLOUD_PROJECT_MAX_BYTES,
  cloudAssetStoragePath,
  validateCloudAssetBytes,
} from "@/lib/cloud-creator-contract";
import { cloudCreatorContext } from "../auth-context";
import type { CloudAsset } from "../contracts/types";
import {
  createAssetRow,
  findAssetStorage,
  findProjectAssets,
  findProjectStorage,
} from "./asset-repository";

export async function listCloudAssets(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await findProjectAssets(supabase, projectId);
  if (error) throw new Error("Asset Libraryを読み込めませんでした。");

  return Promise.all(
    (data ?? []).map(async (asset) => {
      const { data: signed, error: signedError } = await supabase.storage
        .from(CLOUD_ASSET_BUCKET)
        .createSignedUrl(asset.storage_path, 300);
      if (signedError || !signed?.signedUrl)
        throw new Error("Assetの署名URLを作成できませんでした。");
      const { storage_path: _storagePath, ...metadata } = asset;
      return { ...metadata, url: signed.signedUrl } as CloudAsset;
    }),
  );
}

export async function uploadCloudAsset(input: {
  projectId: string;
  assetId?: string;
  expectedSha256?: string;
  fileName: string;
  bytes: Uint8Array;
  mimeType: unknown;
}) {
  const { supabase, profile } = await cloudCreatorContext();
  const validation = await validateCloudAssetBytes({
    bytes: input.bytes,
    declaredMimeType: input.mimeType,
  });
  if (input.expectedSha256 && input.expectedSha256 !== validation.sha256)
    throw new Error("Desktop manifestと画像のSHA-256が一致しません。");

  const { data: project, error: projectError } = await findProjectStorage(
    supabase,
    input.projectId,
  );
  if (projectError || !project)
    throw new Error("Cloud Projectが見つかりません。");
  const storedBytes = Number(project.storage_bytes);
  if (
    !Number.isSafeInteger(storedBytes) ||
    storedBytes < 0 ||
    storedBytes + validation.byteSize > CLOUD_PROJECT_MAX_BYTES
  ) {
    throw new Error("Projectの保存容量上限2GBを超えます。");
  }

  const assetId = input.assetId ?? crypto.randomUUID();
  const storagePath = cloudAssetStoragePath({
    profileId: profile.id,
    projectId: input.projectId,
    assetId,
    mimeType: validation.mimeType,
  });
  const { error: uploadError } = await supabase.storage
    .from(CLOUD_ASSET_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: validation.mimeType,
      upsert: false,
    });
  if (uploadError)
    throw new Error("画像を非公開Storageへ保存できませんでした。");

  const { data: asset, error: insertError } = await createAssetRow(supabase, {
    id: assetId,
    project_id: input.projectId,
    owner_profile_id: profile.id,
    storage_path: storagePath,
    file_name: input.fileName.slice(0, 255),
    mime_type: validation.mimeType,
    byte_size: validation.byteSize,
    width: validation.width,
    height: validation.height,
    sha256: validation.sha256,
  });
  if (insertError || !asset) {
    await supabase.storage.from(CLOUD_ASSET_BUCKET).remove([storagePath]);
    throw new Error("画像情報を保存できませんでした。");
  }
  return asset;
}

export async function createCloudAssetSignedUrl(assetId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data: asset, error } = await findAssetStorage(supabase, assetId);
  if (error || !asset) throw new Error("Assetが見つかりません。");
  const { data, error: signedUrlError } = await supabase.storage
    .from(CLOUD_ASSET_BUCKET)
    .createSignedUrl(asset.storage_path, 300);
  if (signedUrlError || !data?.signedUrl)
    throw new Error("署名URLを作成できませんでした。");
  return data.signedUrl;
}
