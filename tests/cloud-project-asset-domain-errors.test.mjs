import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toApiError } from "../src/lib/api-errors.ts";
import { CloudAssetPayloadTooLargeError } from "../src/lib/cloud-asset-upload.ts";
import { CloudAssetBytesTooLargeError } from "../src/lib/cloud-creator-contract.ts";
import { mapCloudProjectError } from "../src/modules/cloud-creator/projects/project-errors.ts";

test("Project DB signalを権限・未検出codeへ変換する", () => {
  for (const [signal, operation, code, status] of [
    ["cloud_project_not_editable", "rename", "PERMISSION_DENIED", 403],
    ["cover_page_not_found", "cover", "RESOURCE_NOT_FOUND", 404],
    ["cloud_project_not_found", "restore", "RESOURCE_NOT_FOUND", 404],
    [
      "cloud_project_restore_unavailable",
      "restore",
      "RESOURCE_NOT_FOUND",
      404,
    ],
  ]) {
    const response = toApiError(
      mapCloudProjectError({ message: signal }, operation),
      "fallback",
    );
    assert.equal(response.body.errorCode, code);
    assert.equal(response.status, status);
  }
});

test("未知のProject DB signalを操作別INTERNAL_ERRORとして秘匿する", () => {
  const response = toApiError(
    mapCloudProjectError(
      { message: "database_secret_internal_failure" },
      "delete",
    ),
    "fallback",
  );
  assert.deepEqual(response.body, {
    error: "作品をゴミ箱へ移動できませんでした。",
    errorCode: "INTERNAL_ERROR",
  });
  assert.equal(response.status, 500);
});

test("AssetとImportのサイズ超過をPAYLOAD_TOO_LARGEへ統一する", () => {
  for (const error of [
    new CloudAssetPayloadTooLargeError(),
    new CloudAssetBytesTooLargeError(),
  ]) {
    const response = toApiError(error, "fallback");
    assert.equal(response.body.errorCode, "PAYLOAD_TOO_LARGE");
    assert.equal(response.status, 413);
  }
});

test("Project・Asset・Import・Export Routeは共通API Error契約を使う", async () => {
  for (const relative of [
    "../src/app/api/creator/assets/route.ts",
    "../src/app/api/creator/projects/[projectId]/route.ts",
    "../src/app/api/creator/projects/[projectId]/export/route.ts",
    "../src/app/api/creator/projects/import/route.ts",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /toApiError/);
    assert.doesNotMatch(
      source,
      /error instanceof Error\s*\?\s*error\.message/,
    );
  }
});

test("Project・Asset・Import・Export Serviceは生のErrorを生成しない", async () => {
  for (const relative of [
    "../src/modules/cloud-creator/projects/project-service.ts",
    "../src/modules/cloud-creator/assets/asset-service.ts",
    "../src/modules/cloud-creator/import/import-service.ts",
    "../src/modules/cloud-creator/export/export-service.ts",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /throw new Error\(/);
  }

  const actions = await readFile(
    new URL("../src/app/creator/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /domainMessage/);
});
