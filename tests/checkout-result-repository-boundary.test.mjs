import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("checkout success verifies the paid Stripe session before repository access", async () => {
  const page = await read("src/app/checkout/success/page.tsx");

  assert.match(page, /checkout-order-repository/);
  assert.doesNotMatch(page, /createAdminClient|@\/lib\/supabase\/admin/);
  assert.ok(
    page.indexOf("markCheckoutSessionPaid(session)") <
      page.indexOf("getPaidCheckoutDownload(reference)"),
  );
  assert.ok(
    page.indexOf("paidSessionReference(session)") <
      page.indexOf("getPaidCheckoutDownload(reference)"),
  );
});

test("checkout repository preserves paid order and signed download contracts", async () => {
  const repository = await read(
    "src/modules/checkout/infrastructure/checkout-order-repository.ts",
  );
  const start = repository.indexOf("export async function getPaidCheckoutDownload");

  assert.ok(start >= 0);
  const source = repository.slice(start);
  assert.match(
    source,
    /\.select\("status,digital_products:product_id\(title,file_url\)"\)/,
  );
  assert.ok(source.indexOf('.eq("id", input.orderId)') >= 0);
  assert.ok(source.indexOf('.eq("product_id", input.productId)') >= 0);
  assert.ok(source.indexOf('.eq("status", "paid")') >= 0);
  assert.match(source, /\.maybeSingle<CheckoutDownloadOrder>\(\)/);
  assert.match(source, /\.from\("digital-products"\)/);
  assert.match(
    source,
    /\.createSignedUrl\(order\.digital_products\.file_url, 300, \{\s*download: true,/,
  );
});

test("checkout cancel verifies the signed order token before repository access", async () => {
  const page = await read("src/app/checkout/cancel/page.tsx");

  assert.match(page, /checkout-order-repository/);
  assert.doesNotMatch(page, /createAdminClient|@\/lib\/supabase\/admin/);
  assert.ok(
    page.indexOf("verifyCheckoutCancelToken(") <
      page.indexOf("cancelPendingCheckoutOrder(params.order_id)"),
  );
  assert.ok(
    page.indexOf("hasSupabaseAdminEnv()") <
      page.indexOf("cancelPendingCheckoutOrder(params.order_id)"),
  );
  assert.match(page, /注文状態は変更していません/);
});

test("checkout repository cancels only the matching pending order", async () => {
  const repository = await read(
    "src/modules/checkout/infrastructure/checkout-order-repository.ts",
  );
  const start = repository.indexOf("export function cancelPendingCheckoutOrder");

  assert.ok(start >= 0);
  const source = repository.slice(start);
  assert.match(source, /\.from\("orders"\)/);
  assert.match(source, /\.update\(\{ status: "canceled" \}\)/);
  assert.ok(source.indexOf('.eq("id", orderId)') >= 0);
  assert.ok(source.indexOf('.eq("status", "pending")') >= 0);
});
