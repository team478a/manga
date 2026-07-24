import type { createClient } from "@/lib/supabase/server";
import { ownedMarketplaceStoragePath } from "@/lib/content-boundary";
import { StorageTransactionError } from "@/lib/domain-errors";
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
  if (error)
    throw new StorageTransactionError(
      "ファイルをStorageへ保存できませんでした。",
    );
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
    throw new StorageTransactionError(
      "DB更新失敗後のStorage cleanupを完了できませんでした。",
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
