import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveMarketplaceAuthExpiryEnvironment,
  runMarketplaceAuthExpiryAcceptance,
} from "../scripts/check-marketplace-auth-expiry-staging.mjs";

const pendingOrderId = "11111111-1111-4111-8111-111111111111";
const paidOrderId = "22222222-2222-4222-8222-222222222222";

const readyEnvironment = () => ({
  MANGAI_DB_ENV: "staging",
  MANGAI_MARKETPLACE_CHECKOUT_MODE: "test",
  MANGAI_STAGING_PAID_ORDER_ID: paidOrderId,
  MANGAI_STAGING_PARENT_PROJECT_REF: "production-parent-ref",
  MANGAI_STAGING_PENDING_ORDER_ID: pendingOrderId,
  MANGAI_STAGING_PREVIEW_URL:
    "https://mangai-hub-staging-git-acceptance-team.vercel.app",
  MANGAI_STAGING_PROJECT_REF: "preview-branch-ref",
  NEXT_PUBLIC_SUPABASE_URL: "https://preview-branch-ref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-at-least-20-characters",
});

const jwt = (expiresAt) => {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString(
    "base64url",
  );
  return `header.${payload}.signature`;
};

const json = (value, init) =>
  new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

test("隔離Stagingとbranch Preview以外を実行前に拒否する", () => {
  const wrongMode = readyEnvironment();
  wrongMode.MANGAI_MARKETPLACE_CHECKOUT_MODE = "live";
  assert.throws(
    () => resolveMarketplaceAuthExpiryEnvironment(wrongMode),
    /must be test/,
  );

  const production = readyEnvironment();
  production.MANGAI_STAGING_PROJECT_REF =
    production.MANGAI_STAGING_PARENT_PROJECT_REF;
  production.NEXT_PUBLIC_SUPABASE_URL =
    "https://production-parent-ref.supabase.co";
  assert.throws(
    () => resolveMarketplaceAuthExpiryEnvironment(production),
    /distinct/,
  );

  const customDomain = readyEnvironment();
  customDomain.MANGAI_STAGING_PREVIEW_URL = "https://app.mang-ai.com";
  assert.throws(
    () => resolveMarketplaceAuthExpiryEnvironment(customDomain),
    /branch Vercel deployment/,
  );

  const wrongRef = readyEnvironment();
  wrongRef.NEXT_PUBLIC_SUPABASE_URL = "https://another-preview-ref.supabase.co";
  assert.throws(
    () => resolveMarketplaceAuthExpiryEnvironment(wrongRef),
    /does not match/,
  );
});

test("改ざんcancelの前後状態と5分署名URLの失効を実環境手順どおり検査する", async () => {
  let now = Date.parse("2026-09-28T00:00:00.000Z");
  let pendingReads = 0;
  let signedReads = 0;
  const requests = [];
  const fetchFn = async (input, init = {}) => {
    const url = new URL(input);
    requests.push({ method: init.method ?? "GET", url });

    if (url.pathname === "/rest/v1/orders") {
      const orderFilter = url.searchParams.get("id");
      if (orderFilter === `eq.${pendingOrderId}`) {
        pendingReads += 1;
        return json([
          { id: pendingOrderId, payment_mode: "test", status: "pending" },
        ]);
      }
      if (orderFilter === `eq.${paidOrderId}`)
        return json([
          {
            digital_products: { file_url: "products/sample.png" },
            id: paidOrderId,
            payment_mode: "test",
            status: "paid",
          },
        ]);
    }
    if (url.pathname === "/checkout/cancel")
      return new Response("注文状態は変更していません", { status: 200 });
    if (
      url.pathname ===
        "/storage/v1/object/sign/digital-products/products/sample.png" &&
      url.searchParams.has("token")
    ) {
      signedReads += 1;
      return new Response("x", { status: signedReads === 1 ? 206 : 401 });
    }
    if (
      url.pathname ===
      "/storage/v1/object/sign/digital-products/products/sample.png"
    )
      return json({
        signedURL: `/storage/v1/object/sign/digital-products/products/sample.png?token=${jwt(
          Math.floor(now / 1000) + 300,
        )}`,
      });
    throw new Error(`Unexpected request: ${url.pathname}`);
  };

  const report = await runMarketplaceAuthExpiryAcceptance({
    environment: readyEnvironment(),
    fetchFn,
    now: () => now,
    wait: async (milliseconds) => {
      assert.equal(milliseconds, 302_000);
      now += milliseconds;
    },
  });

  assert.equal(pendingReads, 2);
  assert.equal(signedReads, 2);
  assert.ok(Object.values(report.checks).every(Boolean));
  assert.deepEqual(report.safety, {
    environmentValuesPrinted: false,
    paymentCreated: false,
    productionMutation: false,
    stripeRequest: false,
  });
  assert.ok(
    requests.every(({ url }) =>
      ["supabase.co", "vercel.app"].some((suffix) =>
        url.hostname.endsWith(suffix),
      ),
    ),
  );
  assert.equal(
    requests.find(({ url }) => url.pathname === "/checkout/cancel").url
      .searchParams.get("cancel_token"),
    "0".repeat(64),
  );
});

test("改ざんcancelで注文状態が変わった場合は失敗する", async () => {
  let pendingReads = 0;
  const fetchFn = async (input) => {
    const url = new URL(input);
    if (url.pathname === "/rest/v1/orders") {
      pendingReads += 1;
      return json([
        {
          id: pendingOrderId,
          payment_mode: "test",
          status: pendingReads === 1 ? "pending" : "canceled",
        },
      ]);
    }
    if (url.pathname === "/checkout/cancel")
      return new Response("注文状態は変更していません", { status: 200 });
    throw new Error("Acceptance continued after a changed order.");
  };

  await assert.rejects(
    runMarketplaceAuthExpiryAcceptance({
      environment: readyEnvironment(),
      fetchFn,
      now: () => 0,
      wait: async () => {},
    }),
    /changed the staging order/,
  );
});
