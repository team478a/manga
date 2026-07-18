import test from "node:test";
import assert from "node:assert/strict";
import { assertCloudMarketplaceDraftMutable } from "../src/lib/cloud-marketplace-policy.ts";

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
