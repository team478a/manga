import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveMarketplaceAuthExpiryEnvironment } from "./check-marketplace-auth-expiry-staging.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WEBHOOK_ENDPOINT_PATTERN = /^we_[A-Za-z0-9]+$/;
const STRIPE_API_URL = "https://api.stripe.com";
const POLL_LIMIT = 60;

const required = (environment, name) => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing staging environment: ${name}`);
  return value;
};

export function resolveMarketplaceFailureRefundEnvironment(environment) {
  const base = resolveMarketplaceAuthExpiryEnvironment(environment);

  const stripeSecretKey = required(environment, "STRIPE_SECRET_KEY");
  if (
    !stripeSecretKey.startsWith("sk_test_") ||
    /(example|placeholder|redacted|replace|change[-_]?me|x{4,})/i.test(
      stripeSecretKey,
    )
  )
    throw new Error("Stripe Secret Key must be a configured test key.");

  const stripeWebhookEndpointId = required(
    environment,
    "MANGAI_STAGING_STRIPE_WEBHOOK_ENDPOINT_ID",
  );
  if (!WEBHOOK_ENDPOINT_PATTERN.test(stripeWebhookEndpointId))
    throw new Error("Stripe test webhook endpoint ID is invalid.");

  return { ...base, stripeSecretKey, stripeWebhookEndpointId };
}

const authorizedHeaders = (serviceRoleKey) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
});

const responseJson = async (response, label, allowFailure = false) => {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
  if (!allowFailure && !response.ok)
    throw new Error(`${label} failed with HTTP ${response.status}.`);
  return { body, ok: response.ok, status: response.status };
};

const readOrder = async ({ fetchFn, orderId, target }) => {
  const url = new URL("/rest/v1/orders", target.supabaseUrl);
  url.searchParams.set(
    "select",
    "id,status,payment_mode,product_id,creator_id,amount,stripe_payment_intent_id",
  );
  url.searchParams.set("id", `eq.${orderId}`);
  url.searchParams.set("limit", "2");
  const { body } = await responseJson(
    await fetchFn(url, {
      headers: authorizedHeaders(target.serviceRoleKey),
      method: "GET",
    }),
    "Staging order lookup",
  );
  if (!Array.isArray(body) || body.length !== 1)
    throw new Error("Expected exactly one staging order.");
  return body[0];
};

const stripeRequest = async ({
  body,
  fetchFn,
  idempotencyKey,
  method = "GET",
  pathname,
  stripeSecretKey,
}) => {
  const headers = { Authorization: `Bearer ${stripeSecretKey}` };
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return responseJson(
    await fetchFn(new URL(pathname, STRIPE_API_URL), {
      body: body?.toString(),
      headers,
      method,
    }),
    "Stripe test request",
    true,
  );
};

const retrievePaymentIntent = async ({ fetchFn, paymentIntentId, target }) => {
  const url = new URL(
    `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
    STRIPE_API_URL,
  );
  url.searchParams.append("expand[]", "latest_charge");
  const result = await stripeRequest({
    fetchFn,
    pathname: `${url.pathname}${url.search}`,
    stripeSecretKey: target.stripeSecretKey,
  });
  if (!result.ok)
    throw new Error(`Stripe PaymentIntent lookup failed with HTTP ${result.status}.`);
  return result.body;
};

const retrieveWebhookEndpoint = async ({ fetchFn, target }) => {
  const result = await stripeRequest({
    fetchFn,
    pathname: `/v1/webhook_endpoints/${encodeURIComponent(
      target.stripeWebhookEndpointId,
    )}`,
    stripeSecretKey: target.stripeSecretKey,
  });
  if (!result.ok)
    throw new Error(`Stripe webhook endpoint lookup failed with HTTP ${result.status}.`);
  let endpointUrl;
  try {
    endpointUrl = new URL(result.body.url);
  } catch {
    throw new Error("Stripe test webhook endpoint URL is invalid.");
  }
  const queryKeys = [...endpointUrl.searchParams.keys()];
  if (
    result.body.id !== target.stripeWebhookEndpointId ||
    result.body.livemode !== false ||
    result.body.status !== "enabled" ||
    endpointUrl.protocol !== "https:" ||
    !endpointUrl.hostname.endsWith(".vercel.app") ||
    endpointUrl.pathname !== "/api/stripe/webhook" ||
    endpointUrl.username ||
    endpointUrl.password ||
    queryKeys.length !== 1 ||
    queryKeys[0] !== "x-vercel-protection-bypass" ||
    !endpointUrl.searchParams.get("x-vercel-protection-bypass") ||
    !["payment_intent.payment_failed", "charge.refunded"].every((type) =>
      result.body.enabled_events?.includes(type),
    )
  )
    throw new Error("Stripe test webhook endpoint is not the isolated Preview target.");
  return { ...result.body, parsedUrl: endpointUrl };
};

const validateOrderContext = async ({ fetchFn, target }) => {
  const failureOrder = await readOrder({
    fetchFn,
    orderId: target.pendingOrderId,
    target,
  });
  const refundOrder = await readOrder({
    fetchFn,
    orderId: target.paidOrderId,
    target,
  });
  if (
    !["pending", "failed"].includes(failureOrder.status) ||
    failureOrder.payment_mode !== "test" ||
    !UUID_PATTERN.test(failureOrder.product_id) ||
    !UUID_PATTERN.test(failureOrder.creator_id) ||
    !Number.isSafeInteger(failureOrder.amount) ||
    failureOrder.amount <= 0
  )
    throw new Error("Failure canary must be a pending or failed test order.");
  if (
    !["paid", "refunded"].includes(refundOrder.status) ||
    refundOrder.payment_mode !== "test" ||
    typeof refundOrder.stripe_payment_intent_id !== "string" ||
    !refundOrder.stripe_payment_intent_id.startsWith("pi_") ||
    !Number.isSafeInteger(refundOrder.amount) ||
    refundOrder.amount <= 0
  )
    throw new Error("Refund canary must be a paid or refunded test order.");

  const paymentIntent = await retrievePaymentIntent({
    fetchFn,
    paymentIntentId: refundOrder.stripe_payment_intent_id,
    target,
  });
  if (
    paymentIntent.livemode !== false ||
    paymentIntent.currency !== "jpy" ||
    paymentIntent.amount_received !== refundOrder.amount ||
    paymentIntent.status !== "succeeded"
  )
    throw new Error("Refund canary PaymentIntent is not a settled JPY test payment.");
  const webhookEndpoint = await retrieveWebhookEndpoint({ fetchFn, target });
  return { failureOrder, paymentIntent, refundOrder, webhookEndpoint };
};

const listStripeEvents = async ({ fetchFn, since, target, type }) => {
  const url = new URL("/v1/events", STRIPE_API_URL);
  url.searchParams.set("type", type);
  url.searchParams.set("limit", "20");
  url.searchParams.set("created[gte]", String(since));
  const result = await stripeRequest({
    fetchFn,
    pathname: `${url.pathname}${url.search}`,
    stripeSecretKey: target.stripeSecretKey,
  });
  if (!result.ok || !Array.isArray(result.body.data))
    throw new Error(`Stripe event lookup failed with HTTP ${result.status}.`);
  return result.body.data;
};

const waitForStripeEvent = async ({
  fetchFn,
  predicate,
  since,
  target,
  type,
  wait,
}) => {
  for (let attempt = 0; attempt < POLL_LIMIT; attempt += 1) {
    const events = await listStripeEvents({ fetchFn, since, target, type });
    const event = events.find(predicate);
    if (event) return event;
    await wait(1_000);
  }
  throw new Error(`Stripe test event was not available: ${type}.`);
};

const updateWebhookEndpointUrl = async ({ fetchFn, target, url }) => {
  const body = new URLSearchParams();
  body.set("url", url);
  const result = await stripeRequest({
    body,
    fetchFn,
    method: "POST",
    pathname: `/v1/webhook_endpoints/${encodeURIComponent(
      target.stripeWebhookEndpointId,
    )}`,
    stripeSecretKey: target.stripeSecretKey,
  });
  if (
    !result.ok ||
    result.body.id !== target.stripeWebhookEndpointId ||
    result.body.livemode !== false ||
    result.body.status !== "enabled" ||
    result.body.url !== url
  )
    throw new Error(`Stripe webhook endpoint update failed with HTTP ${result.status}.`);
};

const withWebhookEndpointTarget = async ({ context, execute, fetchFn, target }) => {
  const originalUrl = context.webhookEndpoint.parsedUrl;
  const targetUrl = new URL(originalUrl);
  targetUrl.hostname = target.previewUrl.hostname;
  const retargeted = targetUrl.href !== originalUrl.href;
  if (retargeted)
    await updateWebhookEndpointUrl({
      fetchFn,
      target,
      url: targetUrl.href,
    });
  try {
    return await execute();
  } finally {
    if (retargeted) {
      try {
        await updateWebhookEndpointUrl({
          fetchFn,
          target,
          url: originalUrl.href,
        });
      } catch {
        throw new Error("Stripe test webhook endpoint could not be restored.");
      }
    }
  }
};

const waitForOrderStatus = async ({
  expectedStatus,
  fetchFn,
  orderId,
  target,
  wait,
}) => {
  for (let attempt = 0; attempt < POLL_LIMIT; attempt += 1) {
    const order = await readOrder({ fetchFn, orderId, target });
    if (order.status === expectedStatus) return order;
    await wait(1_000);
  }
  throw new Error(`Staging order did not reach ${expectedStatus}.`);
};

const executeFailure = async ({
  context,
  fetchFn,
  now,
  target,
  wait,
}) => {
  if (context.failureOrder.status === "failed") return { alreadyComplete: true };
  const startedAt = Math.floor(now() / 1000) - 5;
  const body = new URLSearchParams();
  body.set("amount", String(context.failureOrder.amount));
  body.set("currency", "jpy");
  body.set("payment_method", "pm_card_chargeDeclined");
  body.append("payment_method_types[]", "card");
  body.set("confirm", "true");
  body.set("metadata[order_id]", context.failureOrder.id);
  body.set("metadata[product_id]", context.failureOrder.product_id);
  body.set("metadata[creator_id]", context.failureOrder.creator_id);
  body.set("metadata[payment_mode]", "test");
  const result = await stripeRequest({
    body,
    fetchFn,
    idempotencyKey: `mangai-staging-failure-${context.failureOrder.id}`,
    method: "POST",
    pathname: "/v1/payment_intents",
    stripeSecretKey: target.stripeSecretKey,
  });
  const paymentIntent = result.body?.error?.payment_intent;
  if (
    result.ok ||
    result.status !== 402 ||
    paymentIntent?.livemode !== false ||
    typeof paymentIntent.id !== "string" ||
    paymentIntent.last_payment_error?.code !== "card_declined"
  )
    throw new Error("Stripe did not create the expected declined test payment.");

  const event = await waitForStripeEvent({
    fetchFn,
    predicate: (candidate) => candidate.data?.object?.id === paymentIntent.id,
    since: startedAt,
    target,
    type: "payment_intent.payment_failed",
    wait,
  });
  if (event.livemode !== false)
    throw new Error("Stripe returned a live failure event.");
  await waitForOrderStatus({
    expectedStatus: "failed",
    fetchFn,
    orderId: context.failureOrder.id,
    target,
    wait,
  });
  return { alreadyComplete: false };
};

const executeRefund = async ({
  context,
  fetchFn,
  now,
  target,
  wait,
}) => {
  if (context.refundOrder.status === "refunded")
    return { alreadyComplete: true };

  let charge = context.paymentIntent.latest_charge;
  if (!charge || typeof charge !== "object" || typeof charge.id !== "string")
    throw new Error("Refund canary PaymentIntent does not contain a charge.");
  const startedAt = charge.refunded
    ? Math.floor(now() / 1000) - 86_400
    : Math.floor(now() / 1000) - 5;
  if (!charge.refunded) {
    const body = new URLSearchParams();
    body.set("payment_intent", context.refundOrder.stripe_payment_intent_id);
    body.set("reason", "requested_by_customer");
    const result = await stripeRequest({
      body,
      fetchFn,
      idempotencyKey: `mangai-staging-refund-${context.refundOrder.id}`,
      method: "POST",
      pathname: "/v1/refunds",
      stripeSecretKey: target.stripeSecretKey,
    });
    if (
      !result.ok ||
      result.body.payment_intent !==
        context.refundOrder.stripe_payment_intent_id ||
      result.body.amount !== context.refundOrder.amount ||
      result.body.status !== "succeeded"
    )
      throw new Error(`Stripe full test refund failed with HTTP ${result.status}.`);
    charge = { ...charge, id: result.body.charge, refunded: true };
  }

  const event = await waitForStripeEvent({
    fetchFn,
    predicate: (candidate) =>
      candidate.data?.object?.id === charge.id &&
      candidate.data?.object?.refunded === true,
    since: startedAt,
    target,
    type: "charge.refunded",
    wait,
  });
  if (event.livemode !== false)
    throw new Error("Stripe returned a live refund event.");
  await waitForOrderStatus({
    expectedStatus: "refunded",
    fetchFn,
    orderId: context.refundOrder.id,
    target,
    wait,
  });
  return { alreadyComplete: false };
};

export async function runMarketplaceFailureRefundAcceptance({
  environment = process.env,
  fetchFn = fetch,
  now = () => Date.now(),
  operation = "preflight",
  wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  const target = resolveMarketplaceFailureRefundEnvironment(environment);
  const context = await validateOrderContext({ fetchFn, target });
  let result = null;
  if (operation === "failure") {
    result =
      context.failureOrder.status === "failed"
        ? { alreadyComplete: true }
        : await withWebhookEndpointTarget({
            context,
            execute: () =>
              executeFailure({ context, fetchFn, now, target, wait }),
            fetchFn,
            target,
          });
  } else if (operation === "refund") {
    result =
      context.refundOrder.status === "refunded"
        ? { alreadyComplete: true }
        : await withWebhookEndpointTarget({
            context,
            execute: () => executeRefund({ context, fetchFn, now, target, wait }),
            fetchFn,
            target,
          });
  }
  else if (operation !== "preflight")
    throw new Error("Unknown marketplace acceptance operation.");

  return {
    checks: {
      failureOrderIsolated: ["pending", "failed"].includes(
        context.failureOrder.status,
      ),
      refundOrderIsolated: ["paid", "refunded"].includes(
        context.refundOrder.status,
      ),
      stripeTestPaymentVerified: true,
      operationCompleted: operation === "preflight" ? true : Boolean(result),
    },
    operation,
    safety: {
      liveStripeRequest: false,
      productionMutation: false,
      providerRequest: false,
      realUserOrderMutation: false,
    },
  };
}

const help = `MANGAI Marketplace failure / refund staging acceptance

Required environment is the same as marketplace:staging:auth-expiry, plus:
  MANGAI_STAGING_STRIPE_WEBHOOK_ENDPOINT_ID
  STRIPE_SECRET_KEY (sk_test_ only)

Operations:
  --preflight         read-only Staging and Stripe test verification
  --execute-failure   create one declined Stripe test PaymentIntent and verify delivery
  --execute-refund    fully refund the isolated paid test PaymentIntent and verify delivery

The command temporarily points the existing Stripe test endpoint at the declared Preview,
restores its original URL, rejects live/Production targets, and never prints secrets,
event payloads, internal IDs, endpoint URLs, or signed URLs.`;

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(help);
  } else {
    const operations = [
      ["--preflight", "preflight"],
      ["--execute-failure", "failure"],
      ["--execute-refund", "refund"],
    ].filter(([flag]) => process.argv.includes(flag));
    if (operations.length !== 1) {
      console.error("Specify exactly one acceptance operation. Use --help for details.");
      process.exitCode = 1;
    } else {
      try {
        const report = await runMarketplaceFailureRefundAcceptance({
          operation: operations[0][1],
        });
        for (const [name, passed] of Object.entries(report.checks))
          console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
        console.log(`Marketplace staging ${report.operation} acceptance passed.`);
      } catch (error) {
        console.error(error instanceof Error ? error.message : "Acceptance failed.");
        process.exitCode = 1;
      }
    }
  }
}
