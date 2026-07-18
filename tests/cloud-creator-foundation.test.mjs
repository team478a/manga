import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  assertOptimisticRevision,
  cloudAssetStoragePath,
  parseCloudProjectImport,
  sumCloudAssetBytes,
  validateCloudAssetBytes,
} from "../src/lib/cloud-creator-contract.ts";

const episodeId = "10000000-0000-4000-8000-000000000001";
const pageId = "10000000-0000-4000-8000-000000000002";
const validManifest = {
  format: "mangai.cloud-project",
  version: 1,
  policyVersion: 1,
  createdBySurface: "desktop",
  project: {
    sourceProjectId: "10000000-0000-4000-8000-000000000003",
    title: "一般向けCloud移行作品",
    description: "",
    contentClass: "general",
    ageRating: "全年齢",
    readingDirection: "rtl",
    width: 1600,
    height: 2400,
    dpi: 300,
  },
  episodes: [{ id: episodeId, title: "第1話", orderIndex: 0 }],
  pages: [
    {
      id: pageId,
      episodeId,
      pageNumber: 1,
      orderIndex: 0,
      width: 1600,
      height: 2400,
      backgroundColor: "#ffffff",
    },
  ],
  assets: [],
  snapshots: [
    { pageId, canvas: { panels: [], balloons: [], textObjects: [] } },
  ],
};

test("Desktop一般向けProject import契約を検証する", () => {
  const parsed = parseCloudProjectImport(validManifest);
  assert.equal(parsed.project.contentClass, "general");
  assert.equal(parsed.pages[0].episodeId, episodeId);
  assert.throws(
    () =>
      parseCloudProjectImport({
        ...validManifest,
        project: { ...validManifest.project, contentClass: "adult" },
      }),
    /成人向けまたは不明/,
  );
  assert.throws(
    () =>
      parseCloudProjectImport({
        ...validManifest,
        project: {
          ...validManifest.project,
          ageRating: "成人向け",
        },
      }),
    /成人向けまたは不明/,
  );
  assert.throws(
    () =>
      parseCloudProjectImport({
        ...validManifest,
        pages: [{ ...validManifest.pages[0], episodeId: pageId }],
      }),
    /検証できません/,
  );
});

test("revision競合を上書き前に検出する", () => {
  assert.doesNotThrow(() => assertOptimisticRevision(4, 4));
  assert.throws(() => assertOptimisticRevision(3, 4), /保存競合/);
  assert.throws(() => assertOptimisticRevision(-1, 0), /不正/);
});

test("Cloud Assetを所有者／Project namespaceへ限定する", () => {
  assert.equal(
    cloudAssetStoragePath({
      profileId: "10000000-0000-4000-8000-000000000010",
      projectId: "10000000-0000-4000-8000-000000000011",
      assetId: "10000000-0000-4000-8000-000000000012",
      mimeType: "image/webp",
    }),
    "10000000-0000-4000-8000-000000000010/10000000-0000-4000-8000-000000000011/10000000-0000-4000-8000-000000000012.webp",
  );
  assert.throws(
    () =>
      cloudAssetStoragePath({
        profileId: "../owner",
        projectId: pageId,
        assetId: episodeId,
        mimeType: "image/png",
      }),
    /IDが不正/,
  );
});

test("Cloud画像はMIME・decode・寸法・hashをServerで再検証する", async () => {
  const bytes = await sharp({
    create: {
      width: 8,
      height: 12,
      channels: 4,
      background: { r: 40, g: 90, b: 180, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const result = await validateCloudAssetBytes({
    bytes,
    declaredMimeType: "image/png",
  });
  assert.equal(result.width, 8);
  assert.equal(result.height, 12);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
  await assert.rejects(
    validateCloudAssetBytes({ bytes, declaredMimeType: "image/jpeg" }),
    /一致しません/,
  );
  await assert.rejects(
    validateCloudAssetBytes({
      bytes: new Uint8Array([1, 2, 3]),
      declaredMimeType: "image/png",
    }),
  );
});

test("soft delete済みAssetを容量集計から除外する", () => {
  assert.equal(
    sumCloudAssetBytes([
      { byteSize: 100, deletedAt: null },
      { byteSize: 200, deletedAt: "2026-07-18T00:00:00.000Z" },
      { byteSize: 300 },
    ]),
    400,
  );
});
