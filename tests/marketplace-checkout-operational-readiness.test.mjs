import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assessMarketplaceCheckoutOperationalReadiness } from "../src/modules/checkout/domain/marketplace-checkout-operational-readiness.ts";

const now = Date.parse("2026-09-30T03:00:00.000Z");
const fakeTestSecret = ["sk", "test", "0123456789abcdefghijklmnop"].join("_");
const fakeLiveSecret = ["sk", "live", "0123456789abcdefghijklmnop"].join("_");
const liveEnvironment = {
  MANGAI_MARKETPLACE_CHECKOUT_MODE: "live",
  STRIPE_SECRET_KEY: fakeLiveSecret,
  MANGAI_MARKETPLACE_LIVE_ACCESS: "canary",
  MANGAI_MARKETPLACE_CANARY_PRODUCT_ID: "11111111-1111-4111-8111-111111111111",
  MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID:
    "22222222-2222-4222-8222-222222222222",
  MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID:
    "33333333-3333-4333-8333-333333333333",
  MANGAI_MARKETPLACE_CANARY_EXPIRES_AT: "2026-09-30T03:45:00.000Z",
  MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT: "a".repeat(64),
};

test("停止中はPENDINGとして安全な理由だけを返す", () => {
  assert.deepEqual(assessMarketplaceCheckoutOperationalReadiness({}, now), {
    ready: false,
    mode: "disabled",
    modeLabel: "停止中",
    reason: "MANGAI内の購入手続きは現在準備中です。",
    canary: null,
  });
});

test("隔離テスト設定は内部設定値を返さずREADYにする", () => {
  const report = assessMarketplaceCheckoutOperationalReadiness(
    {
      MANGAI_MARKETPLACE_CHECKOUT_MODE: "test",
      STRIPE_SECRET_KEY: fakeTestSecret,
      VERCEL_ENV: "preview",
      MANGAI_STAGING_PROJECT_REF: "preview-branch-ref",
      MANGAI_STAGING_PARENT_PROJECT_REF: "production-parent-ref",
      NEXT_PUBLIC_SUPABASE_URL: "https://preview-branch-ref.supabase.co",
    },
    now,
  );

  assert.equal(report.ready, true);
  assert.equal(report.modeLabel, "隔離テスト");
  assert.equal(report.canary, null);
  assert.doesNotMatch(JSON.stringify(report), /sk_test_|preview-branch-ref/);
});

test("限定本番は期限と残り時間だけを返し対象IDやfingerprintを返さない", () => {
  const report = assessMarketplaceCheckoutOperationalReadiness(
    liveEnvironment,
    now,
  );

  assert.deepEqual(report, {
    ready: true,
    mode: "live",
    modeLabel: "限定本番",
    reason: null,
    canary: {
      ready: true,
      expiresAt: "2026-09-30T03:45:00.000Z",
      remainingMinutes: 45,
    },
  });
  assert.doesNotMatch(
    JSON.stringify(report),
    /11111111|22222222|33333333|sk_live_|a{64}/,
  );
});

test("期限切れcanaryはfail closedで対象情報を返さない", () => {
  const report = assessMarketplaceCheckoutOperationalReadiness(
    {
      ...liveEnvironment,
      MANGAI_MARKETPLACE_CANARY_EXPIRES_AT: "2026-09-30T02:59:00.000Z",
    },
    now,
  );

  assert.equal(report.ready, false);
  assert.equal(report.canary?.ready, false);
  assert.equal(report.canary?.expiresAt, null);
  assert.match(report.reason ?? "", /限定販売の対象を確認できない/);
});

test("管理画面はadmin認証後に安全なreadinessを表示する", async () => {
  const [page, panel] = await Promise.all([
    readFile("src/app/admin/marketplace-canary/page.tsx", "utf8"),
    readFile(
      "src/components/admin/MarketplaceCheckoutReadinessPanel.tsx",
      "utf8",
    ),
  ]);
  const authIndex = page.indexOf("await requireAdmin()");
  const readinessIndex = page.indexOf(
    "assessMarketplaceCheckoutOperationalReadiness()",
  );

  assert.ok(authIndex >= 0);
  assert.ok(readinessIndex > authIndex);
  assert.match(page, /MarketplaceCheckoutReadinessPanel/);
  assert.match(panel, /限定販売の購入設定/);
  assert.match(panel, /Stripeキー、商品・販売者・購入者の内部ID/);
  assert.match(panel, /設定変更、注文作成、決済は行いません/);
  assert.doesNotMatch(
    panel,
    /STRIPE_SECRET_KEY|PRODUCT_ID|PROFILE_ID|FINGERPRINT/,
  );
});
