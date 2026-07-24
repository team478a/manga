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
