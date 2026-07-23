import { CLOUD_ASSET_MAX_BYTES } from "./cloud-creator-contract.ts";

export const CLOUD_ASSET_UPLOAD_OVERHEAD_BYTES = 1024 * 1024;
export const CLOUD_ASSET_UPLOAD_MAX_REQUEST_BYTES =
  CLOUD_ASSET_MAX_BYTES + CLOUD_ASSET_UPLOAD_OVERHEAD_BYTES;

export class CloudAssetPayloadTooLargeError extends Error {
  constructor() {
    super("画像は20MB以下にしてください。");
    this.name = "CloudAssetPayloadTooLargeError";
  }
}

export function declaredCloudAssetUploadTooLarge(
  request: Request,
  maxBytes = CLOUD_ASSET_UPLOAD_MAX_REQUEST_BYTES,
) {
  const value = request.headers.get("content-length");
  if (!value) return false;
  const length = Number(value);
  return Number.isFinite(length) && length > maxBytes;
}

export async function readCloudAssetUploadBody(
  request: Request,
  maxBytes = CLOUD_ASSET_UPLOAD_MAX_REQUEST_BYTES,
) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new CloudAssetPayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function parseCloudAssetUploadForm(request: Request) {
  if (declaredCloudAssetUploadTooLarge(request))
    throw new CloudAssetPayloadTooLargeError();
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
    throw new Error("multipart/form-data形式が必要です。");
  const body = await readCloudAssetUploadBody(request);
  return new Response(body, {
    headers: { "content-type": contentType },
  }).formData();
}

export function cloudAssetUploadErrorStatus(error: unknown) {
  return error instanceof CloudAssetPayloadTooLargeError ? 413 : 400;
}
