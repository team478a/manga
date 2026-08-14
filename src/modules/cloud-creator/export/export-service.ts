import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  CLOUD_ASSET_BUCKET,
  CLOUD_ASSET_MAX_BYTES,
  CLOUD_PROJECT_MAX_BYTES,
} from "@/lib/cloud-creator-contract";
import { cloudCreatorContext } from "../auth-context";
import { normalizeCloudCanvas } from "../canvas/canvas-normalizer";
import { getCloudProjectWorkspace } from "../projects/project-service";
import { pageCanvasSchema } from "@mangai/canvas-core";
import {
  DomainError,
  StorageTransactionError,
  ValidationError,
} from "../../../lib/domain-errors.ts";

export async function stageCloudProjectExportBundle(
  projectId: string,
  destination: string,
  options?: { concurrency?: number },
) {
  const { supabase } = await cloudCreatorContext();
  const workspace = await getCloudProjectWorkspace(projectId);
  const pageIds = workspace.pages.map((page) => page.id);
  const [
    { data: snapshots, error: snapshotError },
    { data: assets, error: assetError },
  ] = await Promise.all([
    pageIds.length
      ? supabase
          .from("cloud_canvas_snapshots")
          .select("page_id,revision,canvas")
          .in("page_id", pageIds)
          .order("revision", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("cloud_assets")
      .select(
        "id,project_id,file_name,mime_type,byte_size,width,height,sha256,storage_path",
      )
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ]);
  if (snapshotError || assetError)
    throw new DomainError(
      "INTERNAL_ERROR",
      "Exportデータを読み込めませんでした。",
      { cause: snapshotError ?? assetError },
    );

  const latestSnapshots = new Map<string, unknown>();
  for (const snapshot of snapshots ?? []) {
    if (!latestSnapshots.has(snapshot.page_id))
      latestSnapshots.set(snapshot.page_id, snapshot.canvas);
  }
  const assetRows = assets ?? [];
  if (assetRows.length > 20_000)
    throw new ValidationError(
      "Export対象のAsset数が上限を超えています。",
    );
  const totalBytes = assetRows.reduce(
    (total, asset) => total + asset.byte_size,
    0,
  );
  if (!Number.isSafeInteger(totalBytes) || totalBytes > CLOUD_PROJECT_MAX_BYTES)
    throw new ValidationError(
      "Export対象のAsset合計サイズが上限を超えています。",
    );
  if (
    assetRows.some(
      (asset) =>
        !Number.isSafeInteger(asset.byte_size) ||
        asset.byte_size < 0 ||
        asset.byte_size > CLOUD_ASSET_MAX_BYTES,
    )
  ) {
    throw new ValidationError("Export対象のAssetサイズが不正です。");
  }

  fs.mkdirSync(destination, { recursive: true });
  const assetFiles = new Array<{
    id: string;
    project_id: string;
    file_name: string;
    mime_type: string;
    byte_size: number;
    width: number;
    height: number;
    sha256: string;
    filePath: string;
  }>(assetRows.length);
  let cursor = 0;
  const concurrency = Math.min(4, Math.max(2, options?.concurrency ?? 3));
  const workers = Array.from(
    { length: Math.min(concurrency, assetRows.length) },
    async () => {
      while (cursor < assetRows.length) {
        const index = cursor++;
        const asset = assetRows[index];
        const { data, error } = await supabase.storage
          .from(CLOUD_ASSET_BUCKET)
          .download(asset.storage_path);
        if (error || !data) {
          throw new StorageTransactionError(
            `Asset「${asset.file_name}」を読み込めませんでした。`,
          );
        }
        const bytes = new Uint8Array(await data.arrayBuffer());
        if (
          bytes.byteLength !== asset.byte_size ||
          crypto.createHash("sha256").update(bytes).digest("hex") !==
            asset.sha256
        ) {
          throw new StorageTransactionError(
            `Asset「${asset.file_name}」が破損しています。`,
          );
        }
        const filePath = path.join(destination, asset.id);
        await fs.promises.writeFile(filePath, bytes, {
          flag: "wx",
          mode: 0o600,
        });
        const { storage_path: _storagePath, ...metadata } = asset;
        assetFiles[index] = { ...metadata, filePath };
      }
    },
  );
  const workerResults = await Promise.allSettled(workers);
  const failedWorker = workerResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failedWorker) throw failedWorker.reason;

  return {
    ...workspace,
    pages: workspace.pages.map((page) => ({
      ...page,
      canvas: normalizeCloudCanvas(page, latestSnapshots.get(page.id)),
    })),
    assets: assetFiles,
  };
}

type CheckpointManifestPage = {
  id: string;
  pageNumber: number;
  orderIndex: number;
  revision: number;
  width: number;
  height: number;
  backgroundColor: string;
  canvasSha256: string;
};

type CheckpointManifestAsset = {
  id: string;
  storagePath: string;
  byteSize: number;
  sha256: string;
  width: number;
  height: number;
};

export async function stageCloudProjectCheckpointExportBundle(
  projectId: string,
  checkpointId: string,
  destination: string,
  options?: { concurrency?: number },
) {
  const { supabase } = await cloudCreatorContext();
  const [checkpointResult, projectResult] = await Promise.all([
    supabase.from("cloud_project_checkpoints")
      .select("id,project_id,kind,page_count,manifest,manifest_sha256")
      .eq("id", checkpointId).eq("project_id", projectId).maybeSingle(),
    supabase.from("cloud_projects")
      .select("id,title,description,age_rating,reading_direction,width,height,dpi,cover_page_id,revision,updated_at")
      .eq("id", projectId).is("deleted_at", null).maybeSingle(),
  ]);
  if (checkpointResult.error || projectResult.error || !projectResult.data)
    throw new DomainError("INTERNAL_ERROR", "完成版を読み込めませんでした。", { cause: checkpointResult.error ?? projectResult.error });
  const checkpoint = checkpointResult.data;
  if (!checkpoint || checkpoint.kind !== "release")
    throw new ValidationError("販売に使用できる完成版を選択してください。");
  const manifest = checkpoint.manifest as Record<string, unknown>;
  const pages = Array.isArray(manifest.pages) ? manifest.pages as CheckpointManifestPage[] : [];
  const assets = Array.isArray(manifest.assets) ? manifest.assets as CheckpointManifestAsset[] : [];
  if (pages.length !== Number(checkpoint.page_count) || !pages.length)
    throw new ValidationError("完成版のページ一覧を確認できませんでした。");
  const canvasHashes = pages.map((page) => page.canvasSha256);
  const assetIds = assets.map((asset) => asset.id);
  const [blobsResult, assetsResult] = await Promise.all([
    supabase.from("cloud_project_backup_blobs").select("content_sha256,canvas")
      .eq("project_id", projectId).in("content_sha256", canvasHashes),
    assetIds.length
      ? supabase.from("cloud_assets").select("id,file_name,mime_type").eq("project_id", projectId).in("id", assetIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (blobsResult.error || assetsResult.error)
    throw new DomainError("INTERNAL_ERROR", "完成版の固定データを読み込めませんでした。", { cause: blobsResult.error ?? assetsResult.error });
  const canvases = new Map((blobsResult.data ?? []).map((row) => [row.content_sha256, row.canvas]));
  const assetTypes = new Map((assetsResult.data ?? []).map((row) => [row.id, row]));
  if (canvases.size !== new Set(canvasHashes).size)
    throw new ValidationError("完成版のページデータが不足しています。");
  const totalBytes = assets.reduce((sum, asset) => sum + Number(asset.byteSize), 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes > CLOUD_PROJECT_MAX_BYTES)
    throw new ValidationError("完成版のAsset合計サイズが上限を超えています。");
  fs.mkdirSync(destination, { recursive: true });
  const assetFiles = new Array<{
    id: string;project_id: string;file_name: string;mime_type: string;byte_size: number;
    width: number;height: number;sha256: string;filePath: string;
  }>(assets.length);
  let cursor = 0;
  const concurrency = Math.min(4, Math.max(2, options?.concurrency ?? 3));
  const workers = Array.from({ length: Math.min(concurrency, assets.length) }, async () => {
    while (cursor < assets.length) {
      const index = cursor++;
      const asset = assets[index];
      const metadata = assetTypes.get(asset.id);
      if (!metadata) throw new ValidationError("完成版のAsset情報が不足しています。");
      const downloaded = await supabase.storage.from(CLOUD_ASSET_BUCKET).download(asset.storagePath);
      if (downloaded.error || !downloaded.data) throw new StorageTransactionError(`Asset「${metadata.file_name}」を読み込めませんでした。`);
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      if (bytes.byteLength !== Number(asset.byteSize) || crypto.createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
        throw new StorageTransactionError(`Asset「${metadata.file_name}」が完成版作成時から変化しています。`);
      const filePath = path.join(destination, asset.id);
      await fs.promises.writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
      assetFiles[index] = { id: asset.id, project_id: projectId, file_name: metadata.file_name, mime_type: metadata.mime_type,
        byte_size: Number(asset.byteSize), width: Number(asset.width), height: Number(asset.height), sha256: asset.sha256, filePath };
    }
  });
  const settled = await Promise.allSettled(workers);
  const failed = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failed) throw failed.reason;
  const fixedPages = pages.sort((a, b) => a.pageNumber - b.pageNumber).map((page) => {
    const parsed = pageCanvasSchema.safeParse(canvases.get(page.canvasSha256));
    if (!parsed.success) throw new ValidationError("完成版のCanvas形式を確認できませんでした。");
    return {
      id: page.id, project_id: projectId, episode_id: null, scene_id: null,
      page_number: Number(page.pageNumber), order_index: Number(page.orderIndex), revision: Number(page.revision),
      width: Number(page.width), height: Number(page.height), background_color: page.backgroundColor, canvas: parsed.data,
    };
  });
  return {
    project: projectResult.data,
    pages: fixedPages,
    episodes: [] as Array<Record<string, unknown>>,
    assets: assetFiles,
    checkpoint: { id: checkpoint.id, manifestSha256: checkpoint.manifest_sha256 },
  };
}
