import assert from "node:assert/strict";
import test from "node:test";
import { assessMarketplaceProductionCanaryBundle } from "../scripts/check-marketplace-production-canary-bundle.mjs";

const now = Date.parse("2026-09-28T03:00:00.000Z");
const productId = "11111111-1111-4111-8111-111111111111";
const sellerProfileId = "22222222-2222-4222-8222-222222222222";
const buyerProfileId = "33333333-3333-4333-8333-333333333333";
const fingerprint = "2d19562b291ed9366acb67427165c5afdd3935a4b05bff8ad5ed7d9e2b570c64";

const validPlan = () => ({
  schemaVersion: 1,
  purpose: "marketplace-production-canary",
  environment: "production",
  productionOrigin: "https://app.mang-ai.com",
  checkoutMode: "live",
  productId,
  sellerProfileId,
  buyerProfileId,
  currency: "jpy",
  expectedAmountJpy: 100,
  maxPurchaseCount: 1,
  refundOnAcceptanceFailure: true,
  createdAt: "2026-09-28T03:00:00.000Z",
  expiresAt: "2026-09-28T15:00:00.000Z",
});

const validEnvironment = () => ({
  NEXT_PUBLIC_SUPABASE_URL: "https://production-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "production-anon-key-value",
  SUPABASE_SERVICE_ROLE_KEY: "production-service-role-key-value",
  NEXT_PUBLIC_SITE_URL: "https://app.mang-ai.com",
  MANGAI_MARKETPLACE_CHECKOUT_MODE: "live",
  STRIPE_SECRET_KEY: "sk_live_12345678901234567890",
  STRIPE_WEBHOOK_SECRET: "whsec_12345678901234567890",
  CHECKOUT_CANCEL_SECRET: "independent-cancel-secret-value",
  MANGAI_MARKETPLACE_LIVE_ACCESS: "canary",
  MANGAI_MARKETPLACE_CANARY_PRODUCT_ID: productId,
  MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID: sellerProfileId,
  MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID: buyerProfileId,
  MANGAI_MARKETPLACE_CANARY_EXPIRES_AT: "2026-09-28T15:00:00.000Z",
  MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT: fingerprint,
});

test("計画と候補envが完全一致するbundleだけREADYにする", () => {
  const report = assessMarketplaceProductionCanaryBundle({
    environment: validEnvironment(),
    now,
    plan: validPlan(),
  });

  assert.equal(report.fingerprint, fingerprint);
  assert.equal(report.passed, true);
  assert.ok(report.checks.every((item) => item.ready));
});

test("商品・参加者・期限・fingerprintの取り違えを拒否する", () => {
  for (const mutate of [
    (environment) =>
      (environment.MANGAI_MARKETPLACE_CANARY_PRODUCT_ID =
        "44444444-4444-4444-8444-444444444444"),
    (environment) =>
      (environment.MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID =
        "44444444-4444-4444-8444-444444444444"),
    (environment) =>
      (environment.MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID =
        "44444444-4444-4444-8444-444444444444"),
    (environment) =>
      (environment.MANGAI_MARKETPLACE_CANARY_EXPIRES_AT =
        "2026-09-28T14:00:00.000Z"),
    (environment) =>
      (environment.MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT = "a".repeat(64)),
  ]) {
    const environment = validEnvironment();
    mutate(environment);
    const report = assessMarketplaceProductionCanaryBundle({
      environment,
      now,
      plan: validPlan(),
    });

    assert.equal(report.passed, false);
    assert.equal(
      report.checks.find((item) => item.id === "exact-plan-match").ready,
      false,
    );
  }
});

test("不正な計画または不完全なProduction候補を拒否する", () => {
  const plan = validPlan();
  plan.maxPurchaseCount = 2;
  const environment = validEnvironment();
  environment.MANGAI_MARKETPLACE_CHECKOUT_MODE = "disabled";

  const report = assessMarketplaceProductionCanaryBundle({
    environment,
    now,
    plan,
  });

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((item) => item.id === "approved-plan").ready,
    false,
  );
  assert.equal(
    report.checks.find((item) => item.id === "candidate-checkout-live").ready,
    false,
  );
});

test("reportは計画ID・環境値・秘密値を含めない", () => {
  const environment = validEnvironment();
  const report = assessMarketplaceProductionCanaryBundle({
    environment,
    now,
    plan: validPlan(),
  });
  const serialized = JSON.stringify(report);

  assert.doesNotMatch(serialized, new RegExp(productId, "i"));
  assert.doesNotMatch(serialized, new RegExp(sellerProfileId, "i"));
  assert.doesNotMatch(serialized, new RegExp(buyerProfileId, "i"));
  assert.doesNotMatch(serialized, /sk_live_|whsec_|service-role-key/);
  assert.deepEqual(report.safety, {
    candidateValuesPrinted: false,
    planValuesPrinted: false,
    productionConnection: false,
    productionMutation: false,
    stripeRequest: false,
    paymentCreated: false,
  });
});
