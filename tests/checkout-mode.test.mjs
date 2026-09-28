import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectMarketplaceCheckoutMode,
  paymentModeForStripeLivemode,
  requireMarketplaceCheckoutMode,
} from "../src/lib/checkout-mode.ts";

const fakeTestSecret = ["sk", "test", "0123456789abcdefghijklmnop"].join("_");
const fakeLiveSecret = ["sk", "live", "0123456789abcdefghijklmnop"].join("_");
const liveCanaryEnvironment = () => ({
  MANGAI_MARKETPLACE_CHECKOUT_MODE: "live",
  STRIPE_SECRET_KEY: fakeLiveSecret,
  MANGAI_MARKETPLACE_LIVE_ACCESS: "canary",
  MANGAI_MARKETPLACE_CANARY_PRODUCT_ID:
    "11111111-1111-4111-8111-111111111111",
  MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID:
    "22222222-2222-4222-8222-222222222222",
  MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID:
    "33333333-3333-4333-8333-333333333333",
  MANGAI_MARKETPLACE_CANARY_EXPIRES_AT: new Date(
    Date.now() + 60 * 60 * 1000,
  ).toISOString(),
  MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT: "a".repeat(64),
});

test("販売モード未設定はfail-closedで購入を無効にする", () => {
  assert.deepEqual(inspectMarketplaceCheckoutMode({}), {
    configuredMode: "disabled",
    enabled: false,
    paymentMode: null,
    reason: "MANGAI内の購入手続きは現在準備中です。",
  });
  assert.throws(() => requireMarketplaceCheckoutMode({}), /準備中/);
});

test("テスト販売はStripeテストキーとの組だけを許可する", () => {
  const environment = {
    MANGAI_MARKETPLACE_CHECKOUT_MODE: "test",
    STRIPE_SECRET_KEY: fakeTestSecret,
  };
  assert.deepEqual(inspectMarketplaceCheckoutMode(environment), {
    configuredMode: "test",
    enabled: true,
    paymentMode: "test",
    reason: null,
  });
  assert.equal(requireMarketplaceCheckoutMode(environment), "test");
  assert.equal(
    inspectMarketplaceCheckoutMode({
      ...environment,
      STRIPE_SECRET_KEY: fakeLiveSecret,
    }).enabled,
    false,
  );
  assert.equal(
    inspectMarketplaceCheckoutMode({
      ...environment,
      STRIPE_SECRET_KEY: "sk_test_example_secret_key_value",
    }).enabled,
    false,
  );
});

test("Production deploymentではStripeテスト販売を拒否する", () => {
  const availability = inspectMarketplaceCheckoutMode({
    MANGAI_MARKETPLACE_CHECKOUT_MODE: "test",
    STRIPE_SECRET_KEY: fakeTestSecret,
    VERCEL_ENV: "production",
  });

  assert.equal(availability.enabled, false);
  assert.match(availability.reason, /Productionと分離したStaging/);
});

test("Previewのテスト販売は隔離Supabase接続だけを許可する", () => {
  const base = {
    MANGAI_MARKETPLACE_CHECKOUT_MODE: "test",
    STRIPE_SECRET_KEY: fakeTestSecret,
    VERCEL_ENV: "preview",
    MANGAI_STAGING_PROJECT_REF: "preview-branch-ref",
    MANGAI_STAGING_PARENT_PROJECT_REF: "production-parent-ref",
  };

  assert.equal(
    inspectMarketplaceCheckoutMode({
      ...base,
      NEXT_PUBLIC_SUPABASE_URL:
        "https://preview-branch-ref.supabase.co",
    }).enabled,
    true,
  );
  for (const environment of [
    {
      ...base,
      NEXT_PUBLIC_SUPABASE_URL:
        "https://production-parent-ref.supabase.co",
    },
    {
      ...base,
      MANGAI_STAGING_PROJECT_REF: "production-parent-ref",
      NEXT_PUBLIC_SUPABASE_URL:
        "https://production-parent-ref.supabase.co",
    },
    {
      ...base,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
    },
  ]) {
    const availability = inspectMarketplaceCheckoutMode(environment);
    assert.equal(availability.enabled, false);
    assert.match(availability.reason, /Productionと分離したStaging/);
  }
});

test("本番販売はStripe本番キーとの組だけを許可する", () => {
  assert.equal(
    requireMarketplaceCheckoutMode(liveCanaryEnvironment()),
    "live",
  );
  assert.equal(
    inspectMarketplaceCheckoutMode({
      MANGAI_MARKETPLACE_CHECKOUT_MODE: "live",
      STRIPE_SECRET_KEY: fakeLiveSecret,
    }).enabled,
    false,
  );
  assert.equal(paymentModeForStripeLivemode(false), "test");
  assert.equal(paymentModeForStripeLivemode(true), "live");
});
