import crypto from "node:crypto";
import {
  CLOUD_ASSET_BUCKET,
  cloudAssetStoragePath,
  removeWhiteBackgroundFromMangaLayer,
  sanitizeCloudGeneratedImage,
} from "../../../lib/cloud-creator-contract.ts";
import { logHubError } from "../../../lib/hub-logger.ts";
import { createAdminClient } from "../../../lib/supabase/admin.ts";
import type {
  ClaimedCloudGenerationJob,
  UploadedCloudGeneratedAsset,
} from "../domain/generation-job.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function uploadGeneratedAsset(
  client: AdminClient,
  job: ClaimedCloudGenerationJob,
  image: { bytes: Uint8Array; fileName: string },
  outputAlphaMode: "preserve" | "remove_white",
): Promise<UploadedCloudGeneratedAsset> {
  const sanitized =
    outputAlphaMode === "remove_white"
      ? await removeWhiteBackgroundFromMangaLayer(image.bytes)
      : await sanitizeCloudGeneratedImage(image.bytes);
  const assetId = crypto.randomUUID();
  const storagePath = cloudAssetStoragePath({
    profileId: job.created_by_profile_id,
    projectId: job.project_id,
    assetId,
    mimeType: "image/png",
  });
  const { error: uploadError } = await client.storage
    .from(CLOUD_ASSET_BUCKET)
    .upload(storagePath, sanitized.bytes, {
      contentType: "image/png",
      upsert: false,
    });
  if (uploadError)
    throw new Error("生成画像を非公開Storageへ保存できませんでした。");
  return {
    assetId,
    storagePath,
    fileName: `AI-${image.fileName}`.slice(0, 255),
    byteSize: sanitized.byteSize,
    width: sanitized.width,
    height: sanitized.height,
    sha256: sanitized.sha256,
  };
}

export async function readCloudGenerationJobState(
  client: AdminClient,
  jobId: string,
) {
  const { data } = await client
    .from("cloud_generation_jobs")
    .select("status,output_asset_id")
    .eq("id", jobId)
    .maybeSingle();
  return data as
    | { status: string; output_asset_id: string | null }
    | null
    | undefined;
}

export async function compensateUploadedAsset(
  client: AdminClient,
  job: ClaimedCloudGenerationJob,
  asset: UploadedCloudGeneratedAsset,
) {
  const { error: removeError } = await client.storage
    .from(CLOUD_ASSET_BUCKET)
    .remove([asset.storagePath]);
  if (!removeError) return;
  const lastError =
    typeof removeError.message === "string"
      ? removeError.message
      : "Storage cleanup failed";
  const { error: recordError } = await client.rpc(
    "record_cloud_generation_storage_cleanup",
    {
      p_job_id: job.id,
      p_bucket_id: CLOUD_ASSET_BUCKET,
      p_storage_path: asset.storagePath,
      p_reason: "cloud_generation_db_completion_failed",
      p_last_error: lastError,
    },
  );
  logHubError("cloud_generation_storage_cleanup_pending", removeError, {
    jobId: job.id,
    cleanupRecorded: !recordError,
  });
}

export async function processPendingCloudStorageCleanup(input: {
  client?: AdminClient;
}) {
  const client = input.client ?? createAdminClient();
  const { data: pending, error: readError } = await client
    .from("cloud_generation_storage_cleanup")
    .select("id,job_id,bucket_id,storage_path,attempt_count")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (readError)
    throw new Error("Cloud AI Storage cleanup対象を取得できませんでした。");
  if (!pending) return { status: "idle" as const };
  const { error: removeError } = await client.storage
    .from(pending.bucket_id)
    .remove([pending.storage_path]);
  if (removeError) {
    const { error: updateError } = await client
      .from("cloud_generation_storage_cleanup")
      .update({
        attempt_count: pending.attempt_count + 1,
        last_error: String(removeError.message ?? "Storage cleanup failed").slice(
          0,
          500,
        ),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pending.id);
    if (updateError)
      throw new Error("Cloud AI Storage cleanup失敗を記録できませんでした。");
    return { status: "retrying" as const, cleanupId: pending.id };
  }
  const { error: updateError } = await client
    .from("cloud_generation_storage_cleanup")
    .update({
      status: "resolved",
      last_error: null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", pending.id);
  if (updateError)
    throw new Error("Cloud AI Storage cleanup完了を記録できませんでした。");
  return { status: "resolved" as const, cleanupId: pending.id };
}
