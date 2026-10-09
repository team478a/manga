import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveMarketplaceAccessGuardEnvironment,
  runMarketplaceAccessGuardAcceptance,
} from "../scripts/check-marketplace-access-guards-staging.mjs";

const paidOrderId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const workId = "33333333-3333-4333-8333-333333333333";

const readyEnvironment = () => ({
  MANGAI_DB_ENV: "staging",
  MANGAI_MARKETPLACE_CHECKOUT_MODE: "test",
  MANGAI_STAGING_PAID_ORDER_ID: paidOrderId,
  MANGAI_STAGING_PARENT_PROJECT_REF: "production-parent-ref",
  MANGAI_STAGING_PREVIEW_URL:
    "https://mangai-hub-staging-git-acceptance-team.vercel.app",
  MANGAI_STAGING_PROJECT_REF: "preview-branch-ref",
  MANGAI_STAGING_VERCEL_DEPLOYMENT_ID: "dpl_1234567890abcdef",
  NEXT_PUBLIC_SUPABASE_URL: "https://preview-branch-ref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-at-least-20-characters",
});

const json = (value, init) =>
  new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const createFixtureFetch = ({ failAtPath } = {}) => {
  let productStatus = "active";
  let workPublic = true;
  let downloadCount = 1;
  const mutations = [];
  const fetchFn = async (input, init = {}) => {
    const url = new URL(input);
    if (failAtPath === url.pathname && init.method === "PATCH")
      return json({ error: "forced" }, { status: 500 });
    if (url.pathname === "/rest/v1/orders")
      return json([
        {
          digital_products: {
            id: productId,
            status: productStatus,
            work_id: workId,
          },
          download_count: downloadCount,
          id: paidOrderId,
          payment_mode: "test",
          status: "paid",
        },
      ]);
    if (url.pathname === "/rest/v1/works" && init.method === "GET")
      return json([
        {
          content_class: "general",
          id: workId,
          is_public: workPublic,
          title: "Synthetic staging work",
        },
      ]);
    if (url.pathname === "/rest/v1/digital_products") {
      const body = JSON.parse(init.body);
      if (url.searchParams.get("status") !== `eq.${productStatus}`) return json([]);
      productStatus = body.status;
      mutations.push(`product:${productStatus}`);
      return json([{ id: productId, status: productStatus }]);
    }
    if (url.pathname === "/rest/v1/works" && init.method === "PATCH") {
      const body = JSON.parse(init.body);
      if (url.searchParams.get("is_public") !== `eq.${workPublic}`) return json([]);
      workPublic = body.is_public;
      mutations.push(`work:${workPublic}`);
      return json([{ id: workId, is_public: workPublic }]);
    }
    throw new Error(`Unexpected request: ${init.method ?? "GET"} ${url.pathname}`);
  };
  return {
    fetchFn,
    mutations,
    state: () => ({ downloadCount, productStatus, workPublic }),
  };
};

test("Productionやlive checkoutを実行前に拒否する", () => {
  const wrongMode = readyEnvironment();
  wrongMode.MANGAI_MARKETPLACE_CHECKOUT_MODE = "live";
  assert.throws(
    () => resolveMarketplaceAccessGuardEnvironment(wrongMode),
    /must be test/,
  );

  const production = readyEnvironment();
  production.MANGAI_STAGING_PROJECT_REF =
    production.MANGAI_STAGING_PARENT_PROJECT_REF;
  production.NEXT_PUBLIC_SUPABASE_URL =
    "https://production-parent-ref.supabase.co";
  assert.throws(
    () => resolveMarketplaceAccessGuardEnvironment(production),
    /distinct/,
  );

  const customDomain = readyEnvironment();
  customDomain.MANGAI_STAGING_PREVIEW_URL = "https://app.mang-ai.com";
  assert.throws(
    () => resolveMarketplaceAccessGuardEnvironment(customDomain),
    /branch Vercel deployment/,
  );
});

test("販売停止・非公開・匿名download拒否を確認してfixtureを復元する", async () => {
  const fixture = createFixtureFetch();
  const requested = [];
  const previewRequest = async ({ pathname }) => {
    requested.push(pathname);
    if (pathname.startsWith(`/checkout/${productId}`))
      return {
        body: '<p>この商品は現在購入できません。</p><button disabled="">購入</button>',
        status: 200,
      };
    if (pathname.startsWith(`/works/${workId}`)) {
      if (fixture.state().workPublic)
        return {
          body: "販売中の商品はまだありません。",
          status: 200,
        };
      return { body: "Not Found", status: 404 };
    }
    if (pathname === `/api/purchases/${paidOrderId}/download`)
      return { body: "", status: 307 };
    throw new Error(`Unexpected Preview request: ${pathname}`);
  };

  const report = await runMarketplaceAccessGuardAcceptance({
    environment: readyEnvironment(),
    fetchFn: fixture.fetchFn,
    previewRequest,
  });

  assert.ok(Object.values(report.checks).every(Boolean));
  assert.deepEqual(report.safety, {
    environmentValuesPrinted: false,
    paymentCreated: false,
    productionMutation: false,
    stripeRequest: false,
  });
  assert.deepEqual(fixture.state(), {
    downloadCount: 1,
    productStatus: "active",
    workPublic: true,
  });
  assert.deepEqual(fixture.mutations, [
    "product:paused",
    "product:active",
    "work:false",
    "work:true",
  ]);
  assert.equal(requested.length, 4);
});

test("非公開確認が失敗してもworkを公開状態へ復元する", async () => {
  const fixture = createFixtureFetch();
  const previewRequest = async ({ pathname }) => {
    if (pathname.startsWith(`/checkout/${productId}`))
      return {
        body: '<p>この商品は現在購入できません。</p><button disabled="">購入</button>',
        status: 200,
      };
    if (pathname.startsWith(`/works/${workId}`)) {
      if (fixture.state().workPublic)
        return { body: "販売中の商品はまだありません。", status: 200 };
      return { body: "unexpected public page", status: 200 };
    }
    throw new Error("Acceptance should stop before download.");
  };

  await assert.rejects(
    runMarketplaceAccessGuardAcceptance({
      environment: readyEnvironment(),
      fetchFn: fixture.fetchFn,
      previewRequest,
    }),
    /Private work direct access was not rejected/,
  );
  assert.deepEqual(fixture.state(), {
    downloadCount: 1,
    productStatus: "active",
    workPublic: true,
  });
  assert.ok(fixture.mutations.includes("work:true"));
});

test("RLSがpaused商品を隠してcheckoutを404にしても拒否成功とする", async () => {
  const fixture = createFixtureFetch();
  const previewRequest = async ({ pathname }) => {
    if (pathname.startsWith(`/checkout/${productId}`))
      return { body: "Not Found", status: 404 };
    if (pathname.startsWith(`/works/${workId}`)) {
      if (fixture.state().workPublic)
        return { body: "販売中の商品はまだありません。", status: 200 };
      return { body: "Not Found", status: 404 };
    }
    if (pathname === `/api/purchases/${paidOrderId}/download`)
      return { body: "", status: 401 };
    throw new Error(`Unexpected Preview request: ${pathname}`);
  };

  const report = await runMarketplaceAccessGuardAcceptance({
    environment: readyEnvironment(),
    fetchFn: fixture.fetchFn,
    previewRequest,
  });
  assert.equal(report.checks.pausedCheckoutDisabled, true);
  assert.deepEqual(fixture.state(), {
    downloadCount: 1,
    productStatus: "active",
    workPublic: true,
  });
});

test("Next.jsのstreaming soft 404でも非公開作品情報が出なければ拒否成功とする", async () => {
  const fixture = createFixtureFetch();
  const previewRequest = async ({ pathname }) => {
    if (pathname.startsWith(`/checkout/${productId}`))
      return { body: "Not Found", status: 404 };
    if (pathname.startsWith(`/works/${workId}`)) {
      if (fixture.state().workPublic)
        return { body: "販売中の商品はまだありません。", status: 200 };
      return {
        body: '<meta name="robots" content="noindex"/><h1>404</h1>',
        status: 200,
      };
    }
    if (pathname === `/api/purchases/${paidOrderId}/download`)
      return { body: "", status: 307 };
    throw new Error(`Unexpected Preview request: ${pathname}`);
  };

  const report = await runMarketplaceAccessGuardAcceptance({
    environment: readyEnvironment(),
    fetchFn: fixture.fetchFn,
    previewRequest,
  });
  assert.equal(report.checks.nonPublicDirectAccessRejected, true);
  assert.deepEqual(fixture.state(), {
    downloadCount: 1,
    productStatus: "active",
    workPublic: true,
  });
});
