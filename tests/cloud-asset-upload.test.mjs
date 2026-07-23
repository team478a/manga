import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  CLOUD_ASSET_UPLOAD_MAX_REQUEST_BYTES,
  CloudAssetPayloadTooLargeError,
  cloudAssetUploadErrorStatus,
  declaredCloudAssetUploadTooLarge,
  parseCloudAssetUploadForm,
  readCloudAssetUploadBody,
} from "../src/lib/cloud-asset-upload.ts";
import {
  CLOUD_ASSET_MAX_BYTES,
  CloudAssetBytesTooLargeError,
  validateCloudAssetBytes,
} from "../src/lib/cloud-creator-contract.ts";

test("Content-Length超過はbody展開前に413判定する", () => {
  const request = new Request("https://example.test/api/creator/assets", {
    method: "POST",
    headers: {
      "content-length": String(CLOUD_ASSET_UPLOAD_MAX_REQUEST_BYTES + 1),
    },
  });
  assert.equal(declaredCloudAssetUploadTooLarge(request), true);
  assert.equal(
    cloudAssetUploadErrorStatus(new CloudAssetPayloadTooLargeError()),
    413,
  );
});

test("Content-Lengthなしでもstream実サイズ超過を停止する", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(6));
      controller.enqueue(new Uint8Array(6));
      controller.close();
    },
  });
  const request = new Request("https://example.test/api/creator/assets", {
    method: "POST",
    body: stream,
    duplex: "half",
  });
  await assert.rejects(
    readCloudAssetUploadBody(request, 10),
    CloudAssetPayloadTooLargeError,
  );
});

test("上限以下のmultipart uploadを解析する", async () => {
  const formData = new FormData();
  formData.set("projectId", "10000000-0000-4000-8000-000000000001");
  formData.set(
    "file",
    new File([new Uint8Array([1, 2, 3])], "image.png", {
      type: "image/png",
    }),
  );
  const request = new Request("https://example.test/api/creator/assets", {
    method: "POST",
    body: formData,
  });
  const parsed = await parseCloudAssetUploadForm(request);
  assert.equal(
    parsed.get("projectId"),
    "10000000-0000-4000-8000-000000000001",
  );
  assert.equal(parsed.get("file")?.name, "image.png");
});

test("画像本体が20MBを超えた場合は専用size errorにする", async () => {
  await assert.rejects(
    validateCloudAssetBytes({
      bytes: new Uint8Array(CLOUD_ASSET_MAX_BYTES + 1),
      declaredMimeType: "image/png",
    }),
    CloudAssetBytesTooLargeError,
  );
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

test("100,000,000 pixelsを超えるPNG headerをdecode前に拒否する", async () => {
  const png = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const oversized = Buffer.from(png);
  oversized.writeUInt32BE(10_001, 16);
  oversized.writeUInt32BE(10_000, 20);
  oversized.writeUInt32BE(crc32(oversized.subarray(12, 29)), 29);
  await assert.rejects(
    validateCloudAssetBytes({
      bytes: oversized,
      declaredMimeType: "image/png",
    }),
  );
});
