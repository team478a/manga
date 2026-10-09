import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveOtherBuyerDownloadEnvironment,
  runOtherBuyerDownloadAcceptance,
} from "../scripts/check-marketplace-other-buyer-download-staging.mjs";

const orderId = "11111111-1111-4111-8111-111111111111";
const buyerA = "22222222-2222-4222-8222-222222222222";
const buyerB = "33333333-3333-4333-8333-333333333333";
const userB = "44444444-4444-4444-8444-444444444444";
const productId = "55555555-5555-4555-8555-555555555555";

const readyEnvironment = () => ({
  MANGAI_DB_ENV: "staging",
  MANGAI_MARKETPLACE_CHECKOUT_MODE: "test",
  MANGAI_STAGING_PAID_ORDER_ID: orderId,
  MANGAI_STAGING_PARENT_PROJECT_REF: "production-parent-ref",
  MANGAI_STAGING_PREVIEW_URL:
    "https://mangai-hub-staging-git-acceptance-team.vercel.app",
  MANGAI_STAGING_PROJECT_REF: "preview-branch-ref",
  MANGAI_STAGING_VERCEL_DEPLOYMENT_ID: "dpl_1234567890abcdef",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anonymous-key-at-least-20-characters",
  NEXT_PUBLIC_SUPABASE_URL: "https://preview-branch-ref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-at-least-20-characters",
});

const json = (value, init) =>
  new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const createFixtureFetch = ({ otherBuyerOwnsProduct = false } = {}) => {
  const order = {
    buyer_profile_id: buyerA,
    download_count: 1,
    id: orderId,
    payment_mode: "test",
    product_id: productId,
    status: "paid",
  };
  const fetchFn = async (input) => {
    const url = new URL(input);
    if (url.pathname === "/auth/v1/admin/users")
      return json({
        users: [
          {
            email: "mangai-e2e-unpurchased-preview-branch-ref@example.com",
            id: userB,
          },
        ],
      });
    if (url.pathname === "/rest/v1/profiles")
      return json([{ id: buyerB, role: "buyer", user_id: userB }]);
    if (url.pathname === "/rest/v1/orders") {
      if (url.searchParams.has("buyer_profile_id"))
        return json(otherBuyerOwnsProduct ? [{ id: orderId }] : []);
      return json([{ ...order }]);
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  };
  return { fetchFn, order };
};

const authenticate = async () => ({
  client: { auth: { signOut: async () => {} } },
  cookieValues: [{ name: "auth", options: { path: "/" }, value: "hidden" }],
});

test("Production、live checkout、通常ドメインを実行前に拒否する", () => {
  const production = readyEnvironment();
  production.MANGAI_STAGING_PROJECT_REF = production.MANGAI_STAGING_PARENT_PROJECT_REF;
  production.NEXT_PUBLIC_SUPABASE_URL = "https://production-parent-ref.supabase.co";
  assert.throws(
    () => resolveOtherBuyerDownloadEnvironment(production),
    /distinct/,
  );

  const live = readyEnvironment();
  live.MANGAI_MARKETPLACE_CHECKOUT_MODE = "live";
  assert.throws(() => resolveOtherBuyerDownloadEnvironment(live), /must be test/);

  const productionHost = readyEnvironment();
  productionHost.MANGAI_STAGING_PREVIEW_URL = "https://app.mang-ai.com";
  assert.throws(
    () => resolveOtherBuyerDownloadEnvironment(productionHost),
    /branch Vercel deployment/,
  );
});

test("注文ID未指定時は隔離Stagingの唯一のpaid test注文を対象にできる", async () => {
  const environment = readyEnvironment();
  delete environment.MANGAI_STAGING_PAID_ORDER_ID;
  const fixture = createFixtureFetch();
  const report = await runOtherBuyerDownloadAcceptance({
    authenticate,
    environment,
    fetchFn: fixture.fetchFn,
    previewRequest: async () => ({ body: "not found", status: 404 }),
  });
  assert.equal(report.checks.otherBuyerRejected, true);
});

test("未購入の別Buyerを認証しBuyer Aのdownloadを拒否して注文を変えない", async () => {
  const fixture = createFixtureFetch();
  const requested = [];
  const report = await runOtherBuyerDownloadAcceptance({
    authenticate,
    environment: readyEnvironment(),
    fetchFn: fixture.fetchFn,
    previewRequest: async ({ cookies, pathname }) => {
      requested.push({ cookieCount: cookies.length, pathname });
      return { body: '{"errorCode":"RESOURCE_NOT_FOUND"}', status: 404 };
    },
  });

  assert.ok(Object.values(report.checks).every(Boolean));
  assert.deepEqual(report.safety, {
    credentialsPrinted: false,
    paymentCreated: false,
    productionMutation: false,
    providerRequest: false,
    stripeRequest: false,
  });
  assert.deepEqual(requested, [
    { cookieCount: 1, pathname: `/api/purchases/${orderId}/download` },
  ]);
  assert.equal(fixture.order.download_count, 1);
});

test("別Buyerが対象商品を購入済みなら停止する", async () => {
  const fixture = createFixtureFetch({ otherBuyerOwnsProduct: true });
  await assert.rejects(
    runOtherBuyerDownloadAcceptance({
      authenticate,
      environment: readyEnvironment(),
      fetchFn: fixture.fetchFn,
      previewRequest: async () => ({ body: "", status: 404 }),
    }),
    /already owns/,
  );
});

test("署名URLへ進み得る応答は失敗にする", async () => {
  const fixture = createFixtureFetch();
  await assert.rejects(
    runOtherBuyerDownloadAcceptance({
      authenticate,
      environment: readyEnvironment(),
      fetchFn: fixture.fetchFn,
      previewRequest: async () => ({ body: "", status: 303 }),
    }),
    /was not rejected/,
  );
});
