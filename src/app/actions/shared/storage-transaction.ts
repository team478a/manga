import type { createClient } from "@/lib/supabase/server";
import { ownedMarketplaceStoragePath } from "@/lib/content-boundary";
import { persistWithCompensation } from "./compensating-transaction";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type StorageUpload = {
  bucket: string;
  path: string;
  value: string;
};

function storageFileName(
  authUserId: string,
  resourceId: string,
  file: File,
) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  return ownedMarketplaceStoragePath(
    authUserId,
    resourceId,
    `${crypto.randomUUID()}-${safe}`,
  );
}

export async function uploadMarketplaceFile({
  supabase,
  bucket,
  file,
  authUserId,
  resourceId,
  publicUrl = false,
}: {
  supabase: SupabaseClient;
  bucket: string;
  file: File | null;
  authUserId: string;
  resourceId: string;
  publicUrl?: boolean;
}) {
  if (!file) return null;
  const path = storageFileName(authUserId, resourceId, file);
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const value = publicUrl
    ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
    : path;
  return { bucket, path, value } satisfies StorageUpload;
}

export async function rollbackStorageUpload(
  supabase: SupabaseClient,
  upload: StorageUpload | null,
) {
  if (!upload) return;
  const { error } = await supabase.storage
    .from(upload.bucket)
    .remove([upload.path]);
  if (error) {
    throw new Error(
      `DB更新失敗後のStorage cleanupに失敗しました: ${error.message}`,
    );
  }
}

export async function persistWithStorageRollback<T extends { error: unknown }>({
  supabase,
  upload,
  persist,
}: {
  supabase: SupabaseClient;
  upload: StorageUpload | null;
  persist: () => PromiseLike<T>;
}) {
  return persistWithCompensation({
    persist,
    compensate: () => rollbackStorageUpload(supabase, upload),
  });
}

/**
 * Resolve the owned storage path for a previously stored public URL, so a
 * successful replace (e.g. a new work image) can remove the old object.
 * Returns null unless the path is owned by authUserId/resourceId.
 */
export function ownedStoragePathFromPublicUrl(
  publicUrl: string | null | undefined,
  bucket: string,
  authUserId: string,
  resourceId: string,
) {
  if (!publicUrl) return null;
  try {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const pathname = new URL(publicUrl).pathname;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const path = decodeURIComponent(
      pathname.slice(markerIndex + marker.length),
    );
    const ownedPrefix = `${authUserId.toLowerCase()}/${resourceId.toLowerCase()}/`;
    return path.toLowerCase().startsWith(ownedPrefix) ? path : null;
  } catch {
    return null;
  }
}

export async function removeStorageObject(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
) {
  await supabase.storage.from(bucket).remove([path]);
}
