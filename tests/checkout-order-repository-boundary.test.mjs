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
      action.indexOf("createOrReusePendingCheckoutOrder({", start),
  );
  assert.ok(
    action.indexOf('product.status !== "active"', start) <
      action.indexOf("createOrReusePendingCheckoutOrder({", start),
  );
  assert.ok(
    action.indexOf("assertMarketplaceCanaryCheckoutTarget({", start) <
      action.indexOf("createOrReusePendingCheckoutOrder({", start),
  );
});

test("Stripe Session作成前にもlive canary対象を再検証する", async () => {
  const checkout = await read("src/lib/checkout.ts");

  assert.ok(
    checkout.indexOf("assertMarketplaceCanaryCheckoutTarget({") <
      checkout.indexOf("stripe.checkout.sessions.create("),
  );
  assert.match(checkout, /buyerProfileId: order\.buyer_profile_id/);
  assert.match(checkout, /sellerProfileId: order\.creator_id/);
  assert.match(
    checkout,
    /idempotencyKey: `marketplace-checkout-\$\{order\.id\}`/,
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
    "payment_mode: input.paymentMode",
    'status: "pending"',
  ]) {
    assert.ok(repository.includes(contract), contract);
  }
  assert.match(repository, /\.select\("id"\)/);
  assert.match(repository, /\.single<\{ id: string \}>\(\)/);
});

test("live checkout retry reuses only an exact pending order and recovers an insert race", async () => {
  const repository = await read(
    "src/modules/checkout/infrastructure/checkout-order-repository.ts",
  );

  assert.match(repository, /input\.paymentMode !== "live" \|\| !input\.buyerProfileId/);
  for (const contract of [
    '.eq("buyer_email", input.buyerEmail)',
    '.eq("buyer_profile_id", input.buyerProfileId)',
    '.eq("product_id", input.productId)',
    '.eq("creator_id", input.creatorId)',
    '.eq("amount", input.amount)',
    '.eq("platform_fee", input.platformFee)',
    '.eq("creator_revenue", input.creatorRevenue)',
    '.eq("payment_mode", "live")',
    '.eq("status", "pending")',
  ]) {
    assert.ok(repository.includes(contract), contract);
  }
  assert.match(repository, /const existing = await findReusableLivePendingCheckoutOrder\(input\)/);
  assert.match(repository, /const inserted = await insertPendingCheckoutOrder\(input\)/);
  assert.match(repository, /const recovered = await findReusableLivePendingCheckoutOrder\(input\)/);
  assert.match(repository, /return recovered\.data \? recovered : inserted/);
});

test("checkout action preserves guest checkout, fee calculation, and Stripe ordering", async () => {
  const action = await read("src/app/actions/checkout-actions.ts");

  assert.match(action, /let buyerProfileId: string \| null = null/);
  assert.match(action, /Math\.floor\(amount \* 0\.2\)/);
  assert.match(action, /const creatorRevenue = amount - platformFee/);
  assert.ok(
    action.indexOf("createOrReusePendingCheckoutOrder({") <
      action.indexOf("createStripeCheckoutSession({"),
  );
  assert.match(action, /error=仮注文の作成に失敗しました/);
  assert.match(action, /&orderId=\$\{order\.id\}/);
});

test("checkout entrypoints preserve the browser-visible proxy origin", async () => {
  const action = await read("src/app/actions/checkout-actions.ts");
  const apiRoute = await read("src/app/api/checkout/create-session/route.ts");

  assert.match(action, /requestOriginFromHeaders\(await headers\(\)\)/);
  assert.match(
    apiRoute,
    /requestOriginFromHeaders\(request\.headers\) \?\? new URL\(request\.url\)\.origin/,
  );
});
