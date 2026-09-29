import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live購入再試行は既存pending注文を再利用して同じStripe冪等性キーを使う", async () => {
  const [action, repository, checkout] = await Promise.all([
    read("src/app/actions/checkout-actions.ts"),
    read("src/modules/checkout/infrastructure/checkout-order-repository.ts"),
    read("src/lib/checkout.ts"),
  ]);

  assert.match(action, /createOrReusePendingCheckoutOrder\(\{/);
  assert.doesNotMatch(action, /cancelPendingCheckoutOrder/);
  assert.match(repository, /paymentMode: "test" \| "live"/);
  assert.match(repository, /input\.paymentMode !== "live" \|\| !input\.buyerProfileId/);
  assert.match(repository, /existing\.error \|\| existing\.data/);
  assert.match(repository, /input\.paymentMode !== "live"/);
  assert.match(checkout, /idempotencyKey: `marketplace-checkout-\$\{order\.id\}`/);
});

test("再利用判定は購入者・商品・販売者・金額・手数料・売上を完全一致させる", async () => {
  const repository = await read(
    "src/modules/checkout/infrastructure/checkout-order-repository.ts",
  );

  for (const field of [
    "buyer_email",
    "buyer_profile_id",
    "product_id",
    "creator_id",
    "amount",
    "platform_fee",
    "creator_revenue",
    "payment_mode",
    "status",
  ]) {
    assert.match(repository, new RegExp(`\\.eq\\("${field}"`));
  }
});
