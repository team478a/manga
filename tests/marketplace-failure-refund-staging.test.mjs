import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveMarketplaceFailureRefundEnvironment,
  runMarketplaceFailureRefundAcceptance,
} from "../scripts/check-marketplace-failure-refund-staging.mjs";

const pendingOrderId = "11111111-1111-4111-8111-111111111111";
const paidOrderId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";
const creatorId = "44444444-4444-4444-8444-444444444444";
const paidPaymentIntentId = "pi_paid_test_canary";
const paidChargeId = "ch_paid_test_canary";
const webhookEndpointId = "we_testWebhookEndpoint123";
const originalWebhookUrl = (() => {
  const url = new URL(
    "https://mangai-hub-staging-git-original-team.vercel.app/api/stripe/webhook",
  );
  url.searchParams.set("x-vercel-protection-bypass", "test-only-value");
  return url.href;
})();

const readyEnvironment = () => ({
  MANGAI_DB_ENV: "staging",
  MANGAI_MARKETPLACE_CHECKOUT_MODE: "test",
  MANGAI_STAGING_PAID_ORDER_ID: paidOrderId,
  MANGAI_STAGING_PARENT_PROJECT_REF: "production-parent-ref",
  MANGAI_STAGING_PENDING_ORDER_ID: pendingOrderId,
  MANGAI_STAGING_PREVIEW_URL:
    "https://mangai-hub-staging-git-failure-refund-team.vercel.app",
  MANGAI_STAGING_PROJECT_REF: "preview-branch-ref",
  MANGAI_STAGING_STRIPE_WEBHOOK_ENDPOINT_ID: webhookEndpointId,
  NEXT_PUBLIC_SUPABASE_URL: "https://preview-branch-ref.supabase.co",
  STRIPE_SECRET_KEY: "sk_test_configured_test_key_123456789",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-at-least-20-characters",
});

const json = (value, init) =>
  new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const order = ({ id, status }) => ({
  amount: 100,
  creator_id: creatorId,
  id,
  payment_mode: "test",
  product_id: productId,
  status,
  stripe_payment_intent_id: id === paidOrderId ? paidPaymentIntentId : null,
});

const paymentIntent = ({ refunded = false } = {}) => ({
  amount_received: 100,
  currency: "jpy",
  id: paidPaymentIntentId,
  latest_charge: {
    id: paidChargeId,
    refunded,
  },
  livemode: false,
  status: "succeeded",
});

const createHarness = ({ failureStatus = "pending", refundStatus = "paid" } = {}) => {
  const state = {
    failureStatus,
    refundStatus,
    webhookUrl: originalWebhookUrl,
  };
  const calls = [];
  const fetchFn = async (input, init = {}) => {
    const url = new URL(input);
    const request = {
      body: init.body,
      method: init.method ?? "GET",
      url,
    };
    calls.push(request);

    if (url.pathname === "/rest/v1/orders") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      if (id === pendingOrderId)
        return json([order({ id, status: state.failureStatus })]);
      if (id === paidOrderId)
        return json([order({ id, status: state.refundStatus })]);
    }
    if (url.pathname === `/v1/payment_intents/${paidPaymentIntentId}`)
      return json(paymentIntent());
    if (url.pathname === `/v1/webhook_endpoints/${webhookEndpointId}`) {
      if (request.method === "POST") {
        state.webhookUrl = new URLSearchParams(init.body).get("url");
      }
      return json({
        enabled_events: [
          "payment_intent.payment_failed",
          "charge.refunded",
        ],
        id: webhookEndpointId,
        livemode: false,
        status: "enabled",
        url: state.webhookUrl,
      });
    }
    throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
  };
  return { calls, fetchFn, state };
};

test("Production、live Stripe key、不正なwebhook endpointを外部操作前に拒否する", () => {
  const liveKey = readyEnvironment();
  liveKey.STRIPE_SECRET_KEY = "sk_live_never_allowed_123456789";
  assert.throws(
    () => resolveMarketplaceFailureRefundEnvironment(liveKey),
    /configured test key/,
  );

  const production = readyEnvironment();
  production.MANGAI_STAGING_PROJECT_REF =
    production.MANGAI_STAGING_PARENT_PROJECT_REF;
  production.NEXT_PUBLIC_SUPABASE_URL =
    "https://production-parent-ref.supabase.co";
  assert.throws(
    () => resolveMarketplaceFailureRefundEnvironment(production),
    /distinct/,
  );

  const invalidEndpoint = readyEnvironment();
  invalidEndpoint.MANGAI_STAGING_STRIPE_WEBHOOK_ENDPOINT_ID = "live-endpoint";
  assert.throws(
    () => resolveMarketplaceFailureRefundEnvironment(invalidEndpoint),
    /endpoint ID is invalid/,
  );
});

test("preflightはStaging注文とStripe test PaymentIntentを読むだけである", async () => {
  const { calls, fetchFn } = createHarness();
  const report = await runMarketplaceFailureRefundAcceptance({
    environment: readyEnvironment(),
    fetchFn,
    operation: "preflight",
  });

  assert.ok(Object.values(report.checks).every(Boolean));
  assert.deepEqual(report.safety, {
    liveStripeRequest: false,
    productionMutation: false,
    providerRequest: false,
    realUserOrderMutation: false,
  });
  assert.equal(calls.length, 4);
  assert.ok(calls.every(({ method }) => method === "GET"));
  assert.equal(
    calls.find(({ url }) =>
      url.pathname.startsWith("/v1/payment_intents/"),
    ).url.searchParams.get("expand[]"),
    "latest_charge",
  );
});

test("Stripe自身がPreviewへ配送したpayment_intent.payment_failedでfailedを確認する", async () => {
  const harness = createHarness();
  const failedPaymentIntentId = "pi_declined_test_canary";
  const fetchFn = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === "/v1/payment_intents" && init.method === "POST") {
      const body = new URLSearchParams(init.body);
      assert.equal(body.get("payment_method"), "pm_card_chargeDeclined");
      assert.equal(body.get("metadata[order_id]"), pendingOrderId);
      assert.equal(init.headers["Idempotency-Key"], `mangai-staging-failure-${pendingOrderId}`);
      return json(
        {
          error: {
            code: "card_declined",
            payment_intent: {
              id: failedPaymentIntentId,
              last_payment_error: { code: "card_declined" },
              livemode: false,
            },
          },
        },
        { status: 402 },
      );
    }
    if (url.pathname === "/v1/events") {
      harness.state.failureStatus = "failed";
      return json({
        data: [
          {
            data: { object: { id: failedPaymentIntentId } },
            id: "evt_failed_test_canary",
            livemode: false,
            type: "payment_intent.payment_failed",
          },
        ],
      });
    }
    return harness.fetchFn(input, init);
  };

  const report = await runMarketplaceFailureRefundAcceptance({
    environment: readyEnvironment(),
    fetchFn,
    now: () => Date.parse("2026-09-28T00:00:00.000Z"),
    operation: "failure",
    wait: async () => {},
  });

  assert.ok(Object.values(report.checks).every(Boolean));
  const endpointUpdates = harness.calls.filter(
    ({ method, url }) =>
      method === "POST" &&
      url.pathname === `/v1/webhook_endpoints/${webhookEndpointId}`,
  );
  assert.equal(endpointUpdates.length, 2);
  assert.match(
    new URLSearchParams(endpointUpdates[0].body).get("url"),
    /git-failure-refund-team\.vercel\.app/,
  );
  assert.equal(
    new URLSearchParams(endpointUpdates[1].body).get("url"),
    originalWebhookUrl,
  );
  assert.equal(harness.state.webhookUrl, originalWebhookUrl);
});

test("Stripe test PaymentIntentを全額返金しStripe自身の配送でrefundedを確認する", async () => {
  const harness = createHarness();
  const fetchFn = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === "/v1/refunds" && init.method === "POST") {
      const body = new URLSearchParams(init.body);
      assert.equal(body.get("payment_intent"), paidPaymentIntentId);
      assert.equal(body.has("amount"), false);
      assert.equal(init.headers["Idempotency-Key"], `mangai-staging-refund-${paidOrderId}`);
      return json({
        amount: 100,
        charge: paidChargeId,
        payment_intent: paidPaymentIntentId,
        status: "succeeded",
      });
    }
    if (url.pathname === "/v1/events") {
      harness.state.refundStatus = "refunded";
      return json({
        data: [
          {
            data: {
              object: { id: paidChargeId, refunded: true },
            },
            id: "evt_refunded_test_canary",
            livemode: false,
            type: "charge.refunded",
          },
        ],
      });
    }
    return harness.fetchFn(input, init);
  };

  const report = await runMarketplaceFailureRefundAcceptance({
    environment: readyEnvironment(),
    fetchFn,
    now: () => Date.parse("2026-09-28T00:00:00.000Z"),
    operation: "refund",
    wait: async () => {},
  });

  assert.ok(Object.values(report.checks).every(Boolean));
  assert.equal(harness.state.webhookUrl, originalWebhookUrl);
  assert.equal(
    harness.calls.filter(
      ({ method, url }) =>
        method === "POST" &&
        url.pathname === `/v1/webhook_endpoints/${webhookEndpointId}`,
    ).length,
    2,
  );
});

test("完了済みのfailed/refunded注文ではStripe更新とendpoint変更を繰り返さない", async () => {
  for (const [operation, statuses] of [
    ["failure", { failureStatus: "failed", refundStatus: "paid" }],
    ["refund", { failureStatus: "pending", refundStatus: "refunded" }],
  ]) {
    const { calls, fetchFn } = createHarness(statuses);
    const report = await runMarketplaceFailureRefundAcceptance({
      environment: readyEnvironment(),
      fetchFn,
      operation,
    });
    assert.ok(Object.values(report.checks).every(Boolean));
    assert.ok(calls.every(({ method }) => method === "GET"));
  }
});
