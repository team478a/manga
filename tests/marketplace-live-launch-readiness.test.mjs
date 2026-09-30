import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assessMarketplaceLiveLaunchReadiness } from "../src/modules/checkout/domain/marketplace-live-launch-readiness.ts";

const target = {
  productId: "11111111-1111-4111-8111-111111111111",
  sellerProfileId: "22222222-2222-4222-8222-222222222222",
  buyerProfileId: "33333333-3333-4333-8333-333333333333",
  expiresAt: Date.parse("2026-09-30T12:00:00.000Z"),
  planFingerprint: "a".repeat(64),
};
const checkout = {
  ready: true,
  mode: "live",
  modeLabel: "限定本番",
  reason: null,
  canary: {
    ready: true,
    expiresAt: "2026-09-30T12:00:00.000Z",
    remainingMinutes: 60,
  },
};
const readyInput = {
  checkout,
  target,
  products: [
    {
      id: target.productId,
      work_id: "44444444-4444-4444-8444-444444444444",
      creator_id: target.sellerProfileId,
      price: 500,
      status: "active",
      file_url: "private/sales/package.zip",
    },
  ],
  work: {
    id: "44444444-4444-4444-8444-444444444444",
    creator_id: target.sellerProfileId,
    status: "published",
    is_public: true,
    content_class: "general",
    source_project_id: "55555555-5555-4555-8555-555555555555",
    current_publication_id: "66666666-6666-4666-8666-666666666666",
  },
  profiles: [
    { id: target.sellerProfileId, role: "creator" },
    { id: target.buyerProfileId, role: "buyer" },
  ],
  existingOrders: [],
};

test("設定対象の商品・作品・参加者・注文が揃う場合だけ開始READYにする", () => {
  const report = assessMarketplaceLiveLaunchReadiness(readyInput);

  assert.equal(report.ready, true);
  assert.equal(report.checks.length, 5);
  assert.ok(report.checks.every((item) => item.ready));
  assert.doesNotMatch(
    JSON.stringify(report),
    /11111111|22222222|33333333|private\/sales|a{64}/,
  );
});

test("停止中・隔離テスト・期限切れ相当はDB情報があってもfail closedにする", () => {
  for (const unavailable of [
    { ...checkout, ready: false },
    { ...checkout, mode: "test", modeLabel: "隔離テスト", canary: null },
    { ...checkout, canary: { ...checkout.canary, ready: false } },
  ]) {
    const report = assessMarketplaceLiveLaunchReadiness({
      ...readyInput,
      checkout: unavailable,
    });
    assert.equal(report.ready, false);
    assert.equal(report.checks[0].ready, false);
  }
});

test("商品・完成版・参加者・既存注文の各不一致を独立してPENDINGにする", () => {
  const cases = [
    {
      input: {
        ...readyInput,
        products: [{ ...readyInput.products[0], status: "paused" }],
      },
      id: "exact-product",
    },
    {
      input: {
        ...readyInput,
        work: { ...readyInput.work, current_publication_id: null },
      },
      id: "public-fixed-work",
    },
    {
      input: { ...readyInput, profiles: [readyInput.profiles[0]] },
      id: "isolated-participants",
    },
    {
      input: {
        ...readyInput,
        existingOrders: [{ id: "order", status: "paid" }],
      },
      id: "no-existing-order",
    },
  ];

  for (const item of cases) {
    const report = assessMarketplaceLiveLaunchReadiness(item.input);
    assert.equal(report.ready, false);
    assert.equal(
      report.checks.find((check) => check.id === item.id)?.ready,
      false,
    );
  }
});

test("管理画面はadmin認証後にSELECT限定repositoryを呼び秘密情報を表示しない", async () => {
  const [page, repository, panel] = await Promise.all([
    readFile("src/app/admin/marketplace-canary/page.tsx", "utf8"),
    readFile(
      "src/modules/checkout/infrastructure/admin-marketplace-live-launch-readiness-repository.ts",
      "utf8",
    ),
    readFile(
      "src/components/admin/MarketplaceLiveLaunchReadinessPanel.tsx",
      "utf8",
    ),
  ]);
  const authIndex = page.indexOf("await requireAdmin()");
  const loadIndex = page.indexOf("loadAdminMarketplaceLiveLaunchReadiness(");

  assert.ok(authIndex >= 0);
  assert.ok(loadIndex > authIndex);
  assert.match(
    repository,
    /assertMarketplaceProductionCanaryRuntime\(environment\)/,
  );
  assert.match(repository, /\.from\("digital_products"\)/);
  assert.match(repository, /\.from\("works"\)/);
  assert.match(repository, /\.from\("profiles"\)/);
  assert.match(repository, /\.from\("orders"\)/);
  assert.doesNotMatch(
    repository,
    /\.insert\(|\.update\(|\.upsert\(|\.delete\(|stripe\.checkout/,
  );
  assert.match(panel, /限定販売の開始判定/);
  assert.match(panel, /ID、氏名、メール、販売ファイル/);
  assert.match(panel, /注文作成、決済、設定変更、商品変更は行いません/);
  assert.doesNotMatch(panel, /PRODUCT_ID|PROFILE_ID|STRIPE_SECRET_KEY/);
});
