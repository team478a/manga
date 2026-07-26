import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { toApiError } from "../src/lib/api-errors.ts";
import { mapCloudStructureError } from "../src/modules/cloud-creator/structure/structure-errors.ts";

test("最後のEpisode／Page削除禁止をVALIDATION_ERRORへ変換する", () => {
  for (const [signal, message] of [
    ["last_episode_cannot_be_deleted", "最後のEpisodeは削除できません。"],
    ["last_page_cannot_be_deleted", "最後のPageは削除できません。"],
  ]) {
    const response = toApiError(
      mapCloudStructureError({ message: signal }, "delete"),
      "fallback",
    );
    assert.equal(response.body.errorCode, "VALIDATION_ERROR");
    assert.equal(response.body.error, message);
    assert.equal(response.status, 400);
  }
});

test("Structure編集不可signalをPERMISSION_DENIEDへ変換する", () => {
  for (const signal of [
    "cloud_project_not_editable",
    "cloud_episode_not_editable",
    "cloud_page_not_editable",
  ]) {
    const response = toApiError(
      mapCloudStructureError({ message: signal }, "move"),
      "fallback",
    );
    assert.equal(response.body.errorCode, "PERMISSION_DENIED");
    assert.equal(response.status, 403);
  }
});

test("移動方向不正をVALIDATION_ERRORへ変換する", () => {
  const response = toApiError(
    mapCloudStructureError({ message: "invalid_move_direction" }, "move"),
    "fallback",
  );
  assert.deepEqual(response.body, {
    error: "移動方向が不正です。",
    errorCode: "VALIDATION_ERROR",
  });
  assert.equal(response.status, 400);
});

test("未知のStructure DB signalを操作別INTERNAL_ERRORとして秘匿する", () => {
  for (const [operation, message] of [
    ["add", "Episode／Pageを追加できませんでした。"],
    ["rename", "Episode名を更新できませんでした。"],
    ["move", "Episode／Pageを移動できませんでした。"],
    ["delete", "Episode／Pageを削除できませんでした。"],
  ]) {
    const response = toApiError(
      mapCloudStructureError(
        { message: "database_secret_internal_failure" },
        operation,
      ),
      "fallback",
    );
    assert.deepEqual(response.body, {
      error: message,
      errorCode: "INTERNAL_ERROR",
    });
    assert.equal(response.status, 500);
  }
});

test("Structure ServiceとServer ActionはDBメッセージ部分一致で分岐しない", async () => {
  const service = await readFile(
    new URL(
      "../src/modules/cloud-creator/structure/structure-service.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(service, /message\.includes|includes\(["']last_/);
  assert.match(service, /mapCloudStructureError/);

  const actions = await readFile(
    new URL("../src/app/creator/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /isDomainError/);
  assert.match(actions, /domainMessage/);
});
