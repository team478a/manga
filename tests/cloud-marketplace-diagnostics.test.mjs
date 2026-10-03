import assert from "node:assert/strict";
import test from "node:test";
import {
  CloudMarketplaceDraftSyncError,
  getCloudMarketplaceDraftFailureStage,
  wrapCloudMarketplaceDraftError,
} from "../src/lib/cloud-marketplace-diagnostics.ts";
import {
  StorageTransactionError,
  ValidationError,
} from "../src/lib/domain-errors.ts";

test("販売下書き診断は安全な工程IDを保持する", () => {
  const error = new CloudMarketplaceDraftSyncError(
    "database_sync",
    "INTERNAL_ERROR",
    "販売用下書きを保存できませんでした。",
  );

  assert.equal(getCloudMarketplaceDraftFailureStage(error), "database_sync");
  assert.equal(error.code, "INTERNAL_ERROR");
});

test("既存Domain Errorのcodeと安全な案内を保ったまま工程を付与する", () => {
  const validation = wrapCloudMarketplaceDraftError(
    "artifact_preflight",
    new ValidationError("ページを確定してください。"),
    "fallback",
  );
  const storage = wrapCloudMarketplaceDraftError(
    "artifact_checkpoint_render",
    new StorageTransactionError("完成版Assetを読み込めませんでした。"),
    "fallback",
  );

  assert.equal(validation.code, "VALIDATION_ERROR");
  assert.equal(validation.message, "ページを確定してください。");
  assert.equal(storage.code, "STORAGE_TRANSACTION_ERROR");
  assert.equal(
    getCloudMarketplaceDraftFailureStage(storage),
    "artifact_checkpoint_render",
  );
});

test("未知の例外は生メッセージを露出せずfallbackへ丸める", () => {
  const error = wrapCloudMarketplaceDraftError(
    "artifact_pdf",
    new Error("database secret"),
    "販売用PDFを作成できませんでした。",
  );

  assert.equal(error.code, "INTERNAL_ERROR");
  assert.equal(error.message, "販売用PDFを作成できませんでした。");
  assert.doesNotMatch(error.message, /database secret/);
  assert.equal(getCloudMarketplaceDraftFailureStage(new Error("x")), "unclassified");
});
