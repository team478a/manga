import crypto from "node:crypto";
import { cloudCreatorContext } from "@/modules/cloud-creator/auth-context";
import {
  PayloadTooLargeError,
  StorageTransactionError,
  ValidationError,
} from "./domain-errors";
import { EXTERNAL_SUBMISSION_MAX_SOURCE_BYTES } from "./external-submission-ingest";

export const EXTERNAL_SUBMISSION_UPLOAD_OVERHEAD_BYTES = 1024 * 1024;
export const EXTERNAL_SUBMISSION_UPLOAD_MAX_REQUEST_BYTES =
  EXTERNAL_SUBMISSION_MAX_SOURCE_BYTES + EXTERNAL_SUBMISSION_UPLOAD_OVERHEAD_BYTES;

const allowedTypes = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function safeName(value: string) {
  const result = value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 200);
  return result || "source.bin";
}

export async function uploadExternalSubmissionSource(input: {
  submissionId: string;
  file: File;
}) {
  if (!allowedTypes.has(input.file.type))
    throw new ValidationError("PDF、ZIP、PNG、JPG、WebPのいずれかを選んでください。");
  if (!input.file.size || input.file.size > EXTERNAL_SUBMISSION_MAX_SOURCE_BYTES)
    throw new PayloadTooLargeError("ファイルは50MB以下にしてください。");
  const { supabase, profile } = await cloudCreatorContext();
  const fileId = crypto.randomUUID();
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  if (bytes.byteLength !== input.file.size)
    throw new ValidationError("Uploadサイズを確認できませんでした。");
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  const storagePath = `${profile.id}/${input.submissionId}/${fileId}-${safeName(input.file.name)}`;
  const upload = await supabase.storage
    .from("external-submission-quarantine")
    .upload(storagePath, bytes, { contentType: input.file.type, upsert: false });
  if (upload.error)
    throw new StorageTransactionError("隔離Storageへ保存できませんでした。");
  const registered = await supabase.rpc("register_external_submission_upload", {
    p_submission_id: input.submissionId,
    p_file_id: fileId,
    p_storage_path: storagePath,
    p_original_name: input.file.name.slice(0, 255),
    p_declared_mime_type: input.file.type,
    p_byte_size: bytes.byteLength,
    p_sha256: digest,
  });
  if (registered.error) {
    await supabase.storage.from("external-submission-quarantine").remove([storagePath]);
    throw new StorageTransactionError("Upload情報を登録できませんでした。");
  }
  return { id: fileId, byteSize: bytes.byteLength, sha256: digest };
}

export async function queueExternalSubmissionValidation(submissionId: string) {
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("queue_external_submission_validation", {
    p_submission_id: submissionId,
  });
  if (result.error) throw new ValidationError("検証を開始できませんでした。");
  return result.data as string;
}

export async function reorderExternalSubmissionPages(
  submissionId: string,
  pageIds: string[],
) {
  if (!pageIds.length || pageIds.length > 100)
    throw new ValidationError("ページ順を確認してください。");
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("reorder_external_submission_pages", {
    p_submission_id: submissionId,
    p_page_ids: pageIds,
  });
  if (result.error) throw new ValidationError("ページ順を保存できませんでした。");
  return result.data as string;
}

export async function setExternalSubmissionSamplePages(
  submissionId: string,
  pageIds: string[],
) {
  if (!pageIds.length || pageIds.length > 10)
    throw new ValidationError("試し読みページは1〜10ページで選んでください。");
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("set_external_submission_sample_pages", {
    p_submission_id: submissionId,
    p_page_ids: pageIds,
  });
  if (result.error)
    throw new ValidationError("試し読みページを保存できませんでした。");
  return result.data as string;
}
