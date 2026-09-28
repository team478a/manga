import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveMarketplaceProductionTargetEnvironment,
  runMarketplaceProductionCanaryTargetPreflight,
} from "../scripts/check-marketplace-production-canary-target.mjs";

const now = Date.parse("2026-09-28T03:00:00.000Z");
const plan = () => ({
  schemaVersion: 1,
  purpose: "marketplace-production-canary",
  environment: "production",
  productionOrigin: "https://app.mang-ai.com",
  checkoutMode: "live",
  productId: "11111111-1111-4111-8111-111111111111",
  sellerProfileId: "22222222-2222-4222-8222-222222222222",
  buyerProfileId: "33333333-3333-4333-8333-333333333333",
  currency: "jpy",
  expectedAmountJpy: 100,
  maxPurchaseCount: 1,
  refundOnAcceptanceFailure: true,
  createdAt: "2026-09-28T03:00:00.000Z",
  expiresAt: "2026-09-28T15:00:00.000Z",
});
const environment = () => ({
  NEXT_PUBLIC_SUPABASE_URL: "https://production-parent-ref.supabase.co",
  NEXT_PUBLIC_SITE_URL: "https://app.mang-ai.com",
  SUPABASE_SERVICE_ROLE_KEY: "production-service-role-key-value",
  MANGAI_MARKETPLACE_CHECKOUT_MODE: "disabled",
});

const readyRows = (candidate) => [
  {
    id: candidate.productId,
    creator_id: candidate.sellerProfileId,
    price: candidate.expectedAmountJpy,
    status: "active",
    file_url: "owner/resource/main.pdf",
    works: {
      id: "44444444-4444-4444-8444-444444444444",
      creator_id: candidate.sellerProfileId,
      status: "published",
      is_public: true,
      content_class: "general",
      source_project_id: "55555555-5555-4555-8555-555555555555",
      current_publication_id: "66666666-6666-4666-8666-666666666666",
    },
  },
];

const mockFetch = ({ candidate, orders = [], productRows, profileRows } = {}) => {
  const target = candidate ?? plan();
  return async (url, init) => {
    assert.equal(init.method, "GET");
    assert.equal(init.headers.apikey, environment().SUPABASE_SERVICE_ROLE_KEY);
    if (url.pathname.endsWith("/digital_products"))
      return Response.json(productRows ?? readyRows(target));
    if (url.pathname.endsWith("/profiles"))
      return Response.json(
        profileRows ?? [
          { id: target.sellerProfileId, role: "creator" },
          { id: target.buyerProfileId, role: "buyer" },
        ],
      );
    if (url.pathname.endsWith("/orders")) return Response.json(orders);
    return new Response(null, { status: 404 });
  };
};

test("Production対象をGETだけで照合しREADYにする", async () => {
  const report = await runMarketplaceProductionCanaryTargetPreflight({
    environment: environment(),
    fetchFn: mockFetch(),
    now,
    plan: plan(),
  });

  assert.equal(report.passed, true);
  assert.ok(report.checks.every((item) => item.ready));
  assert.deepEqual(report.safety, {
    requestMethods: ["GET"],
    personalDataSelected: false,
    productFileDownloaded: false,
    productionMutation: false,
    stripeRequest: false,
    paymentCreated: false,
  });
});

test("Production接続先は正規origin、hosted Supabase、非testだけを許可する", () => {
  const staging = environment();
  staging.MANGAI_STAGING_PROJECT_REF = "staging-ref";
  const testMode = environment();
  testMode.MANGAI_MARKETPLACE_CHECKOUT_MODE = "test";
  const local = environment();
  local.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";

  assert.throws(
    () => resolveMarketplaceProductionTargetEnvironment(staging),
    /Staging project markers/,
  );
  assert.throws(
    () => resolveMarketplaceProductionTargetEnvironment(testMode),
    /rejects test checkout mode/,
  );
  assert.throws(
    () => resolveMarketplaceProductionTargetEnvironment(local),
    /HTTPS origin/,
  );
});

test("計画不合格ならProductionへ接続しない", async () => {
  const invalid = plan();
  invalid.maxPurchaseCount = 2;
  let requested = false;

  await assert.rejects(
    runMarketplaceProductionCanaryTargetPreflight({
      environment: environment(),
      fetchFn: async () => {
        requested = true;
        return Response.json([]);
      },
      now,
      plan: invalid,
    }),
    /pass local validation/,
  );
  assert.equal(requested, false);
});

test("商品所有者・価格・状態・file不一致を拒否する", async () => {
  const candidate = plan();
  const productRows = readyRows(candidate);
  productRows[0].price = 200;
  productRows[0].file_url = null;

  const report = await runMarketplaceProductionCanaryTargetPreflight({
    environment: environment(),
    fetchFn: mockFetch({ candidate, productRows }),
    now,
    plan: candidate,
  });

  assert.equal(report.passed, false);
  assert.equal(report.checks.find((item) => item.id === "product").ready, false);
});

test("非公開・成人向け・未固定Cloud作品を拒否する", async () => {
  const candidate = plan();
  const productRows = readyRows(candidate);
  productRows[0].works.content_class = "adult";
  productRows[0].works.current_publication_id = null;

  const report = await runMarketplaceProductionCanaryTargetPreflight({
    environment: environment(),
    fetchFn: mockFetch({ candidate, productRows }),
    now,
    plan: candidate,
  });

  assert.equal(report.passed, false);
  assert.equal(report.checks.find((item) => item.id === "work").ready, false);
});

test("参加者欠落と売り手role不正を拒否する", async () => {
  const candidate = plan();
  const report = await runMarketplaceProductionCanaryTargetPreflight({
    environment: environment(),
    fetchFn: mockFetch({
      candidate,
      profileRows: [{ id: candidate.sellerProfileId, role: "buyer" }],
    }),
    now,
    plan: candidate,
  });

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((item) => item.id === "participants").ready,
    false,
  );
});

test("同じ対象のpendingまたはpaid live注文があれば重複を拒否する", async () => {
  const candidate = plan();
  const report = await runMarketplaceProductionCanaryTargetPreflight({
    environment: environment(),
    fetchFn: mockFetch({ orders: [{ id: "hidden", status: "pending" }] }),
    now,
    plan: candidate,
  });

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((item) => item.id === "no-existing-order").ready,
    false,
  );
});

test("reportへ秘密値・商品・参加者IDを含めない", async () => {
  const candidate = plan();
  const env = environment();
  const report = await runMarketplaceProductionCanaryTargetPreflight({
    environment: env,
    fetchFn: mockFetch({ candidate }),
    now,
    plan: candidate,
  });
  const serialized = JSON.stringify(report);

  assert.doesNotMatch(serialized, new RegExp(candidate.productId, "i"));
  assert.doesNotMatch(serialized, new RegExp(candidate.sellerProfileId, "i"));
  assert.doesNotMatch(serialized, new RegExp(candidate.buyerProfileId, "i"));
  assert.doesNotMatch(serialized, new RegExp(env.SUPABASE_SERVICE_ROLE_KEY));
});
