import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  attachMarketplaceProductionCanaryWorks,
  assessMarketplaceProductionCanaryInventory,
  assertMarketplaceProductionCanaryRuntime,
} from "../src/modules/checkout/domain/production-canary-inventory.ts";

const product = (overrides = {}) => ({
  creator_id: "22222222-2222-4222-8222-222222222222",
  price: 100,
  status: "active",
  file_url: "marketplace/private/file.zip",
  works: {
    creator_id: "22222222-2222-4222-8222-222222222222",
    status: "published",
    is_public: true,
    content_class: "general",
    source_project_id: null,
    current_publication_id: null,
  },
  ...overrides,
});

test("管理画面とCLIで共有する判定は適格商品・販売者を件数だけ返す", () => {
  const report = assessMarketplaceProductionCanaryInventory({
    products: [product()],
    profiles: [
      { id: "22222222-2222-4222-8222-222222222222", role: "creator" },
    ],
  });

  assert.equal(report.passed, true);
  assert.deepEqual(report.counts, {
    checkedActiveProducts: 1,
    eligibleProducts: 1,
    eligibleSellers: 1,
  });
  assert.deepEqual(report.preparation, {
    ready: false,
    checkedProducts: 1,
    pausedProducts: 0,
    activationReadyPausedProducts: 0,
    activationReadySellers: 0,
  });
  assert.doesNotMatch(JSON.stringify(report), /22222222-2222-4222-8222-222222222222/);
});

test("成人向け・Cloud publication未固定・不適格roleを除外する", () => {
  const report = assessMarketplaceProductionCanaryInventory({
    products: [
      product({
        works: { ...product().works, content_class: "adult" },
      }),
      product({
        works: {
          ...product().works,
          source_project_id: "33333333-3333-4333-8333-333333333333",
        },
      }),
    ],
    profiles: [
      { id: "22222222-2222-4222-8222-222222222222", role: "user" },
    ],
  });

  assert.equal(report.passed, false);
  assert.equal(report.counts.eligibleProducts, 0);
  assert.equal(report.counts.eligibleSellers, 0);
});

test("商品と作品はwork_idで明示的に結合し、対応しない作品を採用しない", () => {
  const products = attachMarketplaceProductionCanaryWorks(
    [
      product({
        work_id: "11111111-1111-4111-8111-111111111111",
        works: undefined,
      }),
      product({
        work_id: "99999999-9999-4999-8999-999999999999",
        works: undefined,
      }),
    ],
    [
      {
        id: "11111111-1111-4111-8111-111111111111",
        ...product().works,
      },
    ],
  );

  assert.equal(products[0].works?.status, "published");
  assert.equal(products[1].works, null);
});

test("条件を満たすpaused商品を有効化前候補として件数だけ返す", () => {
  const report = assessMarketplaceProductionCanaryInventory({
    products: [product({ status: "paused" })],
    profiles: [
      { id: "22222222-2222-4222-8222-222222222222", role: "creator" },
    ],
  });

  assert.equal(report.passed, false);
  assert.deepEqual(report.counts, {
    checkedActiveProducts: 0,
    eligibleProducts: 0,
    eligibleSellers: 0,
  });
  assert.deepEqual(report.preparation, {
    ready: true,
    checkedProducts: 1,
    pausedProducts: 1,
    activationReadyPausedProducts: 1,
    activationReadySellers: 1,
  });
  assert.doesNotMatch(JSON.stringify(report), /22222222-2222-4222-8222-222222222222/);
});

test("101件以上の部分集計は候補件数を確定しない", () => {
  const report = assessMarketplaceProductionCanaryInventory({
    products: Array.from({ length: 101 }, () => product()),
    profiles: [
      { id: "22222222-2222-4222-8222-222222222222", role: "creator" },
    ],
  });

  assert.equal(report.passed, false);
  assert.deepEqual(report.counts, {
    checkedActiveProducts: 100,
    eligibleProducts: 0,
    eligibleSellers: 0,
  });
});

test("Production runtimeと正規origin以外はDB接続前に拒否する", () => {
  assert.throws(
    () =>
      assertMarketplaceProductionCanaryRuntime({
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_SITE_URL: "https://app.mang-ai.com",
      }),
    /Production runtime is required/,
  );
  assert.throws(
    () =>
      assertMarketplaceProductionCanaryRuntime({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://preview.example.com",
      }),
    /Production site origin is invalid/,
  );
  assert.doesNotThrow(() =>
    assertMarketplaceProductionCanaryRuntime({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://app.mang-ai.com/",
    }),
  );
});

test("管理画面はadmin認証後だけProduction件数repositoryを呼ぶ", async () => {
  const page = await readFile(
    "src/app/admin/marketplace-canary/page.tsx",
    "utf8",
  );
  const authIndex = page.indexOf("await requireAdmin()");
  const loadIndex = page.indexOf("loadAdminMarketplaceProductionCanaryInventory()");

  assert.ok(authIndex >= 0);
  assert.ok(loadIndex > authIndex);
  assert.match(page, /商品名、利用者名、メールアドレス、内部IDは表示しません/);
  assert.match(page, /販売開始、注文作成、Stripe接続、ファイル取得は行いません/);
  assert.match(page, /有効化可能なpaused商品/);
  assert.match(page, /この画面から商品を有効化・作成することはありません/);
  assert.doesNotMatch(page, /product\.id|creator_id|file_url|display_name|email\}/);
});

test("repositoryはProduction runtimeと正規originを先に検証しGET queryだけを組み立てる", async () => {
  const source = await readFile(
    "src/modules/checkout/infrastructure/admin-production-canary-inventory-repository.ts",
    "utf8",
  );
  const environmentIndex = source.indexOf(
    "assertMarketplaceProductionCanaryRuntime(environment)",
  );
  const clientIndex = source.indexOf("createAdminClient()", environmentIndex);

  assert.ok(environmentIndex >= 0);
  assert.ok(clientIndex > environmentIndex);
  assert.match(source, /\.from\("digital_products"\)/);
  assert.match(source, /\.from\("works"\)/);
  assert.match(source, /\.from\("profiles"\)/);
  assert.match(source, /select\("id,work_id,creator_id,price,status,file_url"\)/);
  assert.doesNotMatch(source, /\.eq\("status", "active"\)/);
  assert.doesNotMatch(source, /works:work_id/);
  assert.match(source, /MarketplaceProductionCanaryProductsReadError/);
  assert.match(source, /MarketplaceProductionCanaryWorksReadError/);
  assert.match(source, /MarketplaceProductionCanaryProfilesReadError/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|stripe/i);
  assert.doesNotMatch(source, /title|display_name|email|buyer_email/);
});

test("既存CLIも共有判定を利用する", async () => {
  const source = await readFile(
    "scripts/check-marketplace-production-canary-inventory.mjs",
    "utf8",
  );
  assert.match(source, /assessMarketplaceProductionCanaryInventory/);
  assert.match(source, /maximumMarketplaceProductionCanaryProducts/);
});
