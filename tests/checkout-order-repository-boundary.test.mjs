import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("checkout action verifies buyer and product before pending order persistence", async () => {
  const action = await read("src/app/actions/checkout-actions.ts");
  const start = action.indexOf("export async function createPendingOrder");

  assert.match(action, /checkout-order-repository/);
  assert.doesNotMatch(action, /createAdminClient|@\/lib\/supabase\/admin/);
  assert.ok(start >= 0);
  assert.ok(
    action.indexOf("await supabase.auth.getUser()", start) <
      action.indexOf("insertPendingCheckoutOrder({", start),
  );
  assert.ok(
    action.indexOf('product.status !== "active"', start) <
      action.indexOf("insertPendingCheckoutOrder({", start),
  );
});

test("checkout repository preserves pending order DB contracts", async () => {
  const repository = await read(
    "src/modules/checkout/infrastructure/checkout-order-repository.ts",
  );

  assert.match(repository, /createAdminClient\(\)/);
  assert.match(repository, /\.from\("orders"\)/);
  for (const contract of [
    "buyer_email: input.buyerEmail",
    "buyer_profile_id: input.buyerProfileId",
    "product_id: input.productId",
    "creator_id: input.creatorId",
    "amount: input.amount",
    "platform_fee: input.platformFee",
    "creator_revenue: input.creatorRevenue",
    'status: "pending"',
  ]) {
    assert.ok(repository.includes(contract), contract);
  }
  assert.match(repository, /\.select\("id"\)/);
  assert.match(repository, /\.single<\{ id: string \}>\(\)/);
});

test("checkout action preserves guest checkout, fee calculation, and Stripe ordering", async () => {
  const action = await read("src/app/actions/checkout-actions.ts");

  assert.match(action, /let buyerProfileId: string \| null = null/);
  assert.match(action, /Math\.floor\(amount \* 0\.2\)/);
  assert.match(action, /const creatorRevenue = amount - platformFee/);
  assert.ok(
    action.indexOf("insertPendingCheckoutOrder({") <
      action.indexOf("createStripeCheckoutSession({"),
  );
  assert.match(action, /error=仮注文の作成に失敗しました/);
  assert.match(action, /&orderId=\$\{order\.id\}/);
});
