import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  CLOUD_ASSET_BUCKET,
  CLOUD_PROJECT_MAX_BYTES,
  cloudAssetStoragePath,
  parseCloudProjectImport,
  validateCloudAssetBytes,
} from "@/lib/cloud-creator-contract";

async function apiContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("認証が必要です。");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("user_id", user.id)
    .single();
  if (error || !profile) throw new Error("プロフィールが必要です。");
  return { supabase, profile };
}

export async function importDesktopCloudProject(value: unknown) {
  const manifest = parseCloudProjectImport(value);
  const { supabase } = await apiContext();
  const { data, error } = await supabase.rpc("import_cloud_project", {
    p_manifest: manifest,
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("このDesktop Projectはすでにimportされています。");
    throw new Error("Cloud Projectをimportできませんでした。");
  }
  return data as string;
}

export async function saveCloudPageSnapshot(input: {
  pageId: string;
  expectedRevision: number;
  canvas: Record<string, unknown>;
}) {
  const { supabase } = await apiContext();
  const { data, error } = await supabase.rpc("save_cloud_page_snapshot", {
    p_page_id: input.pageId,
    p_expected_revision: input.expectedRevision,
    p_canvas: input.canvas,
  });
  if (error) {
    if (error.message.includes("revision_conflict"))
      throw new Error("保存競合を検出しました。Pageを再読込してください。");
    throw new Error("Pageを保存できませんでした。");
  }
  return data as { page_id: string; revision: number; updated_at: string }[];
}

export async function getCloudPageSnapshot(pageId: string) {
  const { supabase } = await apiContext();
  const { data: page, error } = await supabase
    .from("cloud_pages")
    .select("id,project_id,revision,updated_at")
    .eq("id", pageId)
    .is("deleted_at", null)
    .single();
  if (error || !page) throw new Error("Pageが見つかりません。");
  const { data: snapshot, error: snapshotError } = await supabase
    .from("cloud_canvas_snapshots")
    .select("revision,canvas,created_at")
    .eq("page_id", pageId)
    .eq("revision", page.revision)
    .maybeSingle();
  if (snapshotError) throw new Error("Canvasを読み込めませんでした。");
  return { ...page, canvas: snapshot?.canvas ?? {}, snapshot };
}

export async function setCloudProjectDeleted(
  projectId: string,
  deleted: boolean,
) {
  const { supabase } = await apiContext();
  const { data, error } = await supabase.rpc(
    deleted ? "soft_delete_cloud_project" : "restore_cloud_project",
    { p_project_id: projectId },
  );
  if (error)
    throw new Error(
      deleted
        ? "Cloud Projectをゴミ箱へ移動できませんでした。"
        : "Cloud Projectを復元できませんでした。",
    );
  return data as string;
}

export async function uploadCloudAsset(input: {
  projectId: string;
  assetId?: string;
  expectedSha256?: string;
  fileName: string;
  bytes: Uint8Array;
  mimeType: unknown;
}) {
  const { supabase, profile } = await apiContext();
  const validation = await validateCloudAssetBytes({
    bytes: input.bytes,
    declaredMimeType: input.mimeType,
  });
  if (input.expectedSha256 && input.expectedSha256 !== validation.sha256)
    throw new Error("Desktop manifestと画像のSHA-256が一致しません。");
  const { data: project, error: projectError } = await supabase
    .from("cloud_projects")
    .select("id,storage_bytes")
    .eq("id", input.projectId)
    .is("deleted_at", null)
    .single();
  if (projectError || !project)
    throw new Error("Cloud Projectが見つかりません。");
  const storedBytes = Number(project.storage_bytes);
  if (
    !Number.isSafeInteger(storedBytes) ||
    storedBytes < 0 ||
    storedBytes + validation.byteSize > CLOUD_PROJECT_MAX_BYTES
  )
    throw new Error("Projectの保存容量上限2GBを超えます。");
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
  const { data: asset, error: insertError } = await supabase
    .from("cloud_assets")
    .insert({
      id: assetId,
      project_id: input.projectId,
      owner_profile_id: profile.id,
      storage_path: storagePath,
      file_name: input.fileName.slice(0, 255),
      ...{
        mime_type: validation.mimeType,
        byte_size: validation.byteSize,
        width: validation.width,
        height: validation.height,
        sha256: validation.sha256,
      },
    })
    .select("*")
    .single();
  if (insertError || !asset) {
    await supabase.storage.from(CLOUD_ASSET_BUCKET).remove([storagePath]);
    throw new Error("画像情報を保存できませんでした。");
  }
  return asset;
}

export async function createCloudAssetSignedUrl(assetId: string) {
  const supabase = await createClient();
  const { data: asset, error } = await supabase
    .from("cloud_assets")
    .select("storage_path")
    .eq("id", assetId)
    .is("deleted_at", null)
    .single();
  if (error || !asset) throw new Error("Assetが見つかりません。");
  const { data, error: signedUrlError } = await supabase.storage
    .from(CLOUD_ASSET_BUCKET)
    .createSignedUrl(asset.storage_path, 300);
  if (signedUrlError || !data?.signedUrl)
    throw new Error("署名URLを作成できませんでした。");
  return data.signedUrl;
}
