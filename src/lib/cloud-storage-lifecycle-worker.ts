import sharp from "sharp";
import { normalizeCloudCanvas } from "@/modules/cloud-creator/canvas/canvas-normalizer";
import { renderCloudCanvasPng } from "./cloud-canvas-render";
import { CLOUD_ASSET_BUCKET } from "./cloud-creator-contract";
import { createAdminClient } from "./supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;
type ThumbnailClaim = {
  page_id: string;
  project_id: string;
  owner_profile_id: string;
  source_revision: number;
  lease_token: string;
};
type CleanupClaim = {
  id: string;
  bucket_id: "cloud-cache" | "cloud-exports";
  storage_path: string;
  lease_token: string;
};

function canvasAssetIds(canvas: ReturnType<typeof normalizeCloudCanvas>) {
  const ids = new Set<string>();
  for (const panel of canvas.panels.filter((item) => item.visible)) {
    const layers = canvas.panelLayers.filter(
      (layer) => layer.panelId === panel.id && layer.visible && layer.assetId,
    );
    if (layers.some((layer) => layer.type !== "flattened_legacy")) {
      for (const layer of layers.filter(
        (item) => item.type !== "flattened_legacy",
      ))
        if (layer.assetId) ids.add(layer.assetId);
    } else if (panel.imageAssetId) ids.add(panel.imageAssetId);
  }
  return ids;
}

async function download(
  client: AdminClient,
  bucket: string,
  storagePath: string,
) {
  const result = await client.storage.from(bucket).download(storagePath);
  if (result.error || !result.data) throw new Error("thumbnail_storage_read_failed");
  return new Uint8Array(await result.data.arrayBuffer());
}

async function processThumbnail(client: AdminClient, workerId: string) {
  const claim = await client.rpc("claim_cloud_page_thumbnail", {
    p_worker_id: workerId,
    p_lease_seconds: 300,
  });
  if (claim.error) throw new Error("thumbnail_claim_failed");
  const job = claim.data?.[0] as ThumbnailClaim | undefined;
  if (!job) return null;
  try {
    const [pageResult, snapshotResult] = await Promise.all([
      client
        .from("cloud_pages")
        .select(
          "id,project_id,episode_id,page_number,order_index,width,height,background_color,revision",
        )
        .eq("id", job.page_id)
        .eq("revision", job.source_revision)
        .is("deleted_at", null)
        .single(),
      client
        .from("cloud_canvas_snapshots")
        .select("canvas,revision")
        .eq("page_id", job.page_id)
        .eq("revision", job.source_revision)
        .single(),
    ]);
    if (pageResult.error || snapshotResult.error)
      throw new Error("thumbnail_source_stale");
    const canvas = normalizeCloudCanvas(pageResult.data, snapshotResult.data.canvas);
    const assetIds = [...canvasAssetIds(canvas)];
    const assetsResult = assetIds.length
      ? await client
          .from("cloud_assets")
          .select("id,storage_path,mime_type")
          .eq("project_id", job.project_id)
          .is("deleted_at", null)
          .in("id", assetIds)
      : { data: [], error: null };
    if (assetsResult.error || assetsResult.data?.length !== assetIds.length)
      throw new Error("thumbnail_assets_missing");
    const assets = new Map<
      string,
      { mimeType: string; bytes: Uint8Array }
    >();
    for (const asset of assetsResult.data ?? [])
      assets.set(asset.id, {
        mimeType: asset.mime_type,
        bytes: await download(client, CLOUD_ASSET_BUCKET, asset.storage_path),
      });
    const rendered = await renderCloudCanvasPng(canvas, assets);
    const webp = await sharp(Buffer.from(rendered))
      .resize({ width: 320, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toBuffer();
    const metadata = await sharp(webp).metadata();
    if (!metadata.width || !metadata.height)
      throw new Error("thumbnail_metadata_failed");
    const path = `${job.owner_profile_id}/${job.project_id}/${job.page_id}/${job.source_revision}-${job.lease_token}.webp`;
    const upload = await client.storage.from("cloud-cache").upload(path, webp, {
      contentType: "image/webp",
      upsert: false,
      cacheControl: "31536000",
    });
    if (upload.error) throw new Error("thumbnail_storage_write_failed");
    const finish = await client.rpc("complete_cloud_page_thumbnail", {
      p_page_id: job.page_id,
      p_lease_token: job.lease_token,
      p_source_revision: job.source_revision,
      p_storage_path: path,
      p_width: metadata.width,
      p_height: metadata.height,
    });
    if (finish.error) throw new Error("thumbnail_finish_failed");
    return { status: finish.data === "stale" ? "stale" : "thumbnail_completed", pageId: job.page_id };
  } catch (error) {
    await client.rpc("fail_cloud_page_thumbnail", {
      p_page_id: job.page_id,
      p_lease_token: job.lease_token,
      p_error_code: error instanceof Error ? error.message : "thumbnail_failed",
      p_retryable:
        !(error instanceof Error) || error.message !== "thumbnail_source_stale",
    });
    return { status: "thumbnail_failed", pageId: job.page_id };
  }
}

async function processCleanup(client: AdminClient, workerId: string) {
  const claim = await client.rpc("claim_cloud_storage_cleanup", {
    p_worker_id: workerId,
    p_lease_seconds: 300,
  });
  if (claim.error) throw new Error("storage_cleanup_claim_failed");
  const job = claim.data?.[0] as CleanupClaim | undefined;
  if (!job) return null;
  const removal = await client.storage
    .from(job.bucket_id)
    .remove([job.storage_path]);
  if (removal.error) {
    await client.rpc("fail_cloud_storage_cleanup", {
      p_id: job.id,
      p_lease_token: job.lease_token,
      p_error_code: "storage_cleanup_remove_failed",
    });
    return { status: "cleanup_failed", cleanupId: job.id };
  }
  const finish = await client.rpc("complete_cloud_storage_cleanup", {
    p_id: job.id,
    p_lease_token: job.lease_token,
  });
  if (finish.error) throw new Error("storage_cleanup_finish_failed");
  return { status: "cleanup_completed", cleanupId: job.id };
}

export async function processNextCloudStorageLifecycleJob(input: {
  workerId: string;
  client?: AdminClient;
}) {
  const client = input.client ?? createAdminClient();
  const thumbnail = await processThumbnail(client, input.workerId);
  if (thumbnail) return thumbnail;
  await client.rpc("queue_expired_cloud_storage_artifacts");
  const cleanup = await processCleanup(client, input.workerId);
  return cleanup ?? { status: "idle" as const };
}
