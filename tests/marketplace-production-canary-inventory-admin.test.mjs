import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
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
  assert.match(source, /\.from\("profiles"\)/);
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
