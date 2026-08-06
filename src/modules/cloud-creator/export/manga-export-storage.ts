import { CLOUD_ASSET_BUCKET } from "@/lib/cloud-creator-contract";
import type { MangaExportAdminClient } from "./manga-export-repository";

export async function downloadExportAsset(
  client: MangaExportAdminClient,
  storagePath: string,
) {
  return downloadExportObject(client, CLOUD_ASSET_BUCKET, storagePath);
}

export async function downloadExportObject(
  client: MangaExportAdminClient,
  bucket: string,
  storagePath: string,
) {
  const result = await client.storage.from(bucket).download(storagePath);
  if (result.error || !result.data) throw new Error("export_storage_read_failed");
  return new Uint8Array(await result.data.arrayBuffer());
}

export async function uploadExportObject(
  client: MangaExportAdminClient,
  storagePath: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const result = await client.storage
    .from("cloud-exports")
    .upload(storagePath, bytes, { contentType, upsert: true });
  if (result.error) throw new Error("export_storage_write_failed");
}
