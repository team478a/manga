import test from "node:test";
import assert from "node:assert/strict";
import {
  assertCloudMarketplaceDraftMutable,
  assertCloudMarketplaceManuscriptReady,
} from "../src/lib/cloud-marketplace-policy.ts";
import { ValidationError } from "../src/lib/domain-errors.ts";

test("完成preflightを通過した原稿だけを販売下書きへ進める", () => {
  assert.doesNotThrow(() =>
    assertCloudMarketplaceManuscriptReady({ ready: true, errorCount: 0 }),
  );
  assert.throws(
    () =>
      assertCloudMarketplaceManuscriptReady({ ready: false, errorCount: 267 }),
    (error) =>
      error instanceof ValidationError &&
      /要修正267件.*すべてのページを確定/.test(error.message),
  );
  assert.throws(
    () =>
      assertCloudMarketplaceManuscriptReady({ ready: false, errorCount: 0 }),
    /原稿チェックを完了.*すべてのページを確定/,
  );
});

test("新規・非公開作品・停止中商品だけをCloudから同期できる", () => {
  assert.doesNotThrow(() => assertCloudMarketplaceDraftMutable({}));
  assert.doesNotThrow(() =>
    assertCloudMarketplaceDraftMutable({
      workStatus: "draft",
      workIsPublic: false,
      productStatus: "paused",
    }),
  );
  assert.throws(
    () =>
      assertCloudMarketplaceDraftMutable({
        workStatus: "published",
        workIsPublic: true,
      }),
    /公開中/,
  );
  assert.throws(
    () => assertCloudMarketplaceDraftMutable({ productStatus: "active" }),
    /販売中/,
  );
});
