import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertMarketplaceCanaryCheckoutTarget,
  inspectMarketplaceLiveCanary,
  isMarketplaceCanaryCheckoutListing,
  isMarketplaceCanaryCheckoutTarget,
} from "../src/lib/checkout-canary.ts";

const now = Date.parse("2026-09-28T03:00:00.000Z");
const environment = () => ({
  MANGAI_MARKETPLACE_LIVE_ACCESS: "canary",
  MANGAI_MARKETPLACE_CANARY_PRODUCT_ID:
    "11111111-1111-4111-8111-111111111111",
  MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID:
    "22222222-2222-4222-8222-222222222222",
  MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID:
    "33333333-3333-4333-8333-333333333333",
  MANGAI_MARKETPLACE_CANARY_EXPIRES_AT: "2026-09-28T15:00:00.000Z",
  MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT: "a".repeat(64),
});

test("24時間以内の固定商品・売り手・買い手だけを有効にする", () => {
  const report = inspectMarketplaceLiveCanary(environment(), now);

  assert.equal(report.enabled, true);
  assert.equal(report.target?.productId, environment().MANGAI_MARKETPLACE_CANARY_PRODUCT_ID);
  assert.equal(report.target?.expiresAt, Date.parse("2026-09-28T15:00:00.000Z"));
});

test("対象・fingerprint・期限が欠けるlive設定をfail closedにする", () => {
  const missing = environment();
  delete missing.MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT;
  const expired = environment();
  expired.MANGAI_MARKETPLACE_CANARY_EXPIRES_AT = "2026-09-28T02:00:00.000Z";
  const longWindow = environment();
  longWindow.MANGAI_MARKETPLACE_CANARY_EXPIRES_AT = "2026-09-29T04:00:00.000Z";

  for (const candidate of [missing, expired, longWindow]) {
    assert.equal(inspectMarketplaceLiveCanary(candidate, now).enabled, false);
  }
});

test("liveは3つの対象IDが完全一致する場合だけ許可する", () => {
  const candidate = environment();
  const input = {
    buyerProfileId: candidate.MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID,
    environment: candidate,
    now,
    paymentMode: "live",
    productId: candidate.MANGAI_MARKETPLACE_CANARY_PRODUCT_ID,
    sellerProfileId: candidate.MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID,
  };

  assert.equal(isMarketplaceCanaryCheckoutTarget(input), true);
  assert.equal(
    isMarketplaceCanaryCheckoutTarget({ ...input, buyerProfileId: null }),
    false,
  );
  assert.throws(
    () =>
      assertMarketplaceCanaryCheckoutTarget({
        ...input,
        productId: "44444444-4444-4444-8444-444444444444",
      }),
    /指定された購入者/,
  );
});

test("隔離Stagingのtest販売はcanary gateの対象外にする", () => {
  assert.equal(
    isMarketplaceCanaryCheckoutTarget({
      buyerProfileId: null,
      environment: {},
      now,
      paymentMode: "test",
      productId: "not-a-production-product",
      sellerProfileId: "not-a-production-seller",
    }),
    true,
  );
});

test("未ログインでも固定商品と売り手が一致すれば購入準備だけを開ける", () => {
  const candidate = environment();
  const input = {
    environment: candidate,
    now,
    paymentMode: "live",
    productId: candidate.MANGAI_MARKETPLACE_CANARY_PRODUCT_ID,
    sellerProfileId: candidate.MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID,
  };

  assert.equal(isMarketplaceCanaryCheckoutListing(input), true);
  assert.equal(
    isMarketplaceCanaryCheckoutListing({
      ...input,
      productId: "44444444-4444-4444-8444-444444444444",
    }),
    false,
  );
  assert.equal(
    isMarketplaceCanaryCheckoutTarget({
      ...input,
      buyerProfileId: null,
    }),
    false,
  );
});

test("公開画面と購入画面もログイン済みbuyer profileで対象を絞る", async () => {
  const [workPage, checkoutPage] = await Promise.all([
    readFile(new URL("../src/app/works/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/checkout/[productId]/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  for (const source of [workPage, checkoutPage]) {
    assert.match(source, /isMarketplaceCanaryCheckoutListing/);
    assert.match(source, /isMarketplaceCanaryCheckoutTarget/);
    assert.match(source, /\.eq\("user_id", user\.id\)/);
    assert.match(source, /buyerProfileId/);
  }
  assert.match(workPage, /購入準備へ/);
  assert.match(checkoutPage, /disabled=\{!canPurchase\}/);
});

test("DBは同一購入者・商品の本番pending／paidを1件に制限する", async () => {
  const [migration, rollback] = await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/202609280002_marketplace_live_single_purchase.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/rollbacks/202609280002_marketplace_live_single_purchase.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(migration, /create unique index if not exists orders_live_single_purchase_idx/i);
  assert.match(migration, /on public\.orders\(product_id, buyer_profile_id\)/i);
  assert.match(migration, /payment_mode = 'live'/i);
  assert.match(migration, /status in \('pending', 'paid'\)/i);
  assert.match(rollback, /drop index if exists public\.orders_live_single_purchase_idx/i);
});
