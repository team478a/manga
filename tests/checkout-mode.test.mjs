import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectMarketplaceCheckoutMode,
  paymentModeForStripeLivemode,
  requireMarketplaceCheckoutMode,
} from "../src/lib/checkout-mode.ts";

const fakeTestSecret = ["sk", "test", "0123456789abcdefghijklmnop"].join("_");
const fakeLiveSecret = ["sk", "live", "0123456789abcdefghijklmnop"].join("_");

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

test("本番販売はStripe本番キーとの組だけを許可する", () => {
  assert.equal(
    requireMarketplaceCheckoutMode({
      MANGAI_MARKETPLACE_CHECKOUT_MODE: "live",
      STRIPE_SECRET_KEY: fakeLiveSecret,
    }),
    "live",
  );
  assert.equal(paymentModeForStripeLivemode(false), "test");
  assert.equal(paymentModeForStripeLivemode(true), "live");
});
