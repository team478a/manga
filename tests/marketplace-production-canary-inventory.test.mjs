import assert from "node:assert/strict";
import test from "node:test";
import { runMarketplaceProductionCanaryInventory } from "../scripts/check-marketplace-production-canary-inventory.mjs";

const environment = () => ({
  NEXT_PUBLIC_SUPABASE_URL: "https://production-project.supabase.co",
  NEXT_PUBLIC_SITE_URL: "https://app.mang-ai.com",
  SUPABASE_SERVICE_ROLE_KEY: "production-service-role-key-value",
  MANGAI_MARKETPLACE_CHECKOUT_MODE: "disabled",
});

const product = (overrides = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  creator_id: "22222222-2222-4222-8222-222222222222",
  price: 100,
  status: "active",
  file_url: "marketplace/private/file.zip",
  works: {
    id: "33333333-3333-4333-8333-333333333333",
    creator_id: "22222222-2222-4222-8222-222222222222",
    status: "published",
    is_public: true,
    content_class: "general",
    source_project_id: null,
    current_publication_id: null,
  },
  ...overrides,
});

const response = (rows) => ({
  ok: true,
  status: 200,
  json: async () => rows,
});

test("一般向け公開作品の少額商品と適格売り手を集計する", async () => {
  const requests = [];
  const report = await runMarketplaceProductionCanaryInventory({
    environment: environment(),
    fetchFn: async (url, options) => {
      requests.push({ options, url: new URL(url) });
      return requests.length === 1
        ? response([product()])
        : response([
            {
              id: "22222222-2222-4222-8222-222222222222",
              role: "creator",
            },
          ]);
    },
  });

  assert.equal(report.passed, true);
  assert.deepEqual(report.counts, {
    checkedActiveProducts: 1,
    eligibleProducts: 1,
    eligibleSellers: 1,
  });
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.options.method === "GET"));
  assert.ok(
    requests.every(
      (request) =>
        request.url.origin === "https://production-project.supabase.co",
    ),
  );
});

test("価格・file・作品公開条件・売り手role不一致を候補から除外する", async () => {
  const products = [
    product({ price: 49 }),
    product({ id: "44444444-4444-4444-8444-444444444444", file_url: "" }),
    product({
      id: "55555555-5555-4555-8555-555555555555",
      works: { ...product().works, content_class: "adult" },
    }),
    product({
      id: "66666666-6666-4666-8666-666666666666",
      creator_id: "77777777-7777-4777-8777-777777777777",
      works: {
        ...product().works,
        creator_id: "77777777-7777-4777-8777-777777777777",
      },
    }),
  ];
  let requestCount = 0;
  const report = await runMarketplaceProductionCanaryInventory({
    environment: environment(),
    fetchFn: async () => {
      requestCount += 1;
      return requestCount === 1
        ? response(products)
        : response([
            {
              id: "22222222-2222-4222-8222-222222222222",
              role: "creator",
            },
            {
              id: "77777777-7777-4777-8777-777777777777",
              role: "user",
            },
          ]);
    },
  });

  assert.equal(report.passed, false);
  assert.equal(report.counts.checkedActiveProducts, 4);
  assert.equal(report.counts.eligibleProducts, 0);
  assert.equal(report.counts.eligibleSellers, 0);
});

test("Cloud由来作品は固定publicationを必須にする", async () => {
  const cloudProduct = product({
    works: {
      ...product().works,
      source_project_id: "88888888-8888-4888-8888-888888888888",
    },
  });
  let requestCount = 0;
  const report = await runMarketplaceProductionCanaryInventory({
    environment: environment(),
    fetchFn: async () => {
      requestCount += 1;
      return requestCount === 1
        ? response([cloudProduct])
        : response([
            {
              id: cloudProduct.creator_id,
              role: "creator",
            },
          ]);
    },
  });

  assert.equal(report.passed, false);
  assert.equal(report.counts.eligibleProducts, 0);
});

test("100件を超えるactive商品は部分集計をREADYにしない", async () => {
  const products = Array.from({ length: 101 }, (_, index) =>
    product({ id: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111` }),
  );
  let requestCount = 0;
  const report = await runMarketplaceProductionCanaryInventory({
    environment: environment(),
    fetchFn: async () => {
      requestCount += 1;
      return response(products);
    },
  });

  assert.equal(report.passed, false);
  assert.equal(requestCount, 1);
  assert.equal(report.counts.checkedActiveProducts, 100);
  assert.equal(
    report.checks.find((item) => item.id === "bounded-inventory").ready,
    false,
  );
});

test("結果とrequestは個人情報・名称・file取得を含めない", async () => {
  const requests = [];
  const item = product();
  const report = await runMarketplaceProductionCanaryInventory({
    environment: environment(),
    fetchFn: async (url, options) => {
      requests.push({ options, url: new URL(url) });
      return requests.length === 1
        ? response([item])
        : response([{ id: item.creator_id, role: "creator" }]);
    },
  });
  const serialized = JSON.stringify(report);

  assert.doesNotMatch(serialized, new RegExp(item.id, "i"));
  assert.doesNotMatch(serialized, new RegExp(item.creator_id, "i"));
  assert.ok(
    requests.every((request) => {
      const selected = request.url.searchParams.get("select") ?? "";
      return !/name|email|title|payment|file_url.*download/i.test(selected);
    }),
  );
  assert.deepEqual(report.safety, {
    requestMethods: ["GET", "GET"],
    identifiersPrinted: false,
    personalDataSelected: false,
    productFileDownloaded: false,
    productionMutation: false,
    stripeRequest: false,
    paymentCreated: false,
  });
});
