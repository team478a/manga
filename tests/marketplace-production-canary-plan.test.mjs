import assert from "node:assert/strict";
import test from "node:test";
import {
  assessMarketplaceProductionCanaryPlan,
  resolveCanaryPlanPath,
} from "../scripts/check-marketplace-production-canary-plan.mjs";

const now = Date.parse("2026-09-28T03:00:00.000Z");
const validPlan = () => ({
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

test("1商品・別参加者・1回・少額・24時間以内だけREADYにする", () => {
  const report = assessMarketplaceProductionCanaryPlan(validPlan(), { now });

  assert.equal(report.passed, true);
  assert.match(report.fingerprint, /^[0-9a-f]{64}$/);
  assert.ok(report.checks.every((item) => item.ready));
  assert.deepEqual(report.safety, {
    planValuesPrinted: false,
    productionConnection: false,
    productionMutation: false,
    stripeRequest: false,
    paymentCreated: false,
  });
});

test("同じ計画は同じ承認fingerprintになる", () => {
  const first = assessMarketplaceProductionCanaryPlan(validPlan(), { now });
  const second = assessMarketplaceProductionCanaryPlan(validPlan(), { now });

  assert.equal(first.fingerprint, second.fingerprint);
});

test("余分な自由記述・メール・秘密fieldを拒否する", () => {
  const plan = validPlan();
  plan.buyerEmail = "buyer@example.com";

  const report = assessMarketplaceProductionCanaryPlan(plan, { now });

  assert.equal(report.passed, false);
  assert.equal(report.fingerprint, null);
  assert.equal(
    report.checks.find((item) => item.id === "fixed-schema").ready,
    false,
  );
});

test("Preview・test mode・誤originを拒否する", () => {
  const plan = validPlan();
  plan.environment = "preview";
  plan.checkoutMode = "test";
  plan.productionOrigin = "https://preview.example.com";

  const report = assessMarketplaceProductionCanaryPlan(plan, { now });

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((item) => item.id === "production-target").ready,
    false,
  );
});

test("不正UUIDと売り手本人の購入を拒否する", () => {
  const invalid = validPlan();
  invalid.productId = "product-1";
  const selfPurchase = validPlan();
  selfPurchase.buyerProfileId = selfPurchase.sellerProfileId;

  assert.equal(
    assessMarketplaceProductionCanaryPlan(invalid, { now }).passed,
    false,
  );
  assert.equal(
    assessMarketplaceProductionCanaryPlan(selfPurchase, { now }).passed,
    false,
  );
});

test("複数購入・上限超過・返金fallbackなしを拒否する", () => {
  const multiple = validPlan();
  multiple.maxPurchaseCount = 2;
  const expensive = validPlan();
  expensive.expectedAmountJpy = 1001;
  const noRefund = validPlan();
  noRefund.refundOnAcceptanceFailure = false;

  assert.equal(
    assessMarketplaceProductionCanaryPlan(multiple, { now }).passed,
    false,
  );
  assert.equal(
    assessMarketplaceProductionCanaryPlan(expensive, { now }).passed,
    false,
  );
  assert.equal(
    assessMarketplaceProductionCanaryPlan(noRefund, { now }).passed,
    false,
  );
});

test("期限切れと24時間超過を拒否する", () => {
  const expired = validPlan();
  expired.expiresAt = "2026-09-28T02:59:59.000Z";
  const tooLong = validPlan();
  tooLong.expiresAt = "2026-09-29T03:00:00.001Z";

  assert.equal(
    assessMarketplaceProductionCanaryPlan(expired, { now }).passed,
    false,
  );
  assert.equal(
    assessMarketplaceProductionCanaryPlan(tooLong, { now }).passed,
    false,
  );
});

test("reportは商品・参加者IDを含めない", () => {
  const plan = validPlan();
  const serialized = JSON.stringify(
    assessMarketplaceProductionCanaryPlan(plan, { now }),
  );

  assert.doesNotMatch(serialized, new RegExp(plan.productId, "i"));
  assert.doesNotMatch(serialized, new RegExp(plan.sellerProfileId, "i"));
  assert.doesNotMatch(serialized, new RegExp(plan.buyerProfileId, "i"));
});

test("計画ファイルは絶対pathかつrepository外だけ許可する", () => {
  assert.throws(
    () =>
      resolveCanaryPlanPath({
        argument: "relative-plan.json",
        repositoryRoot: "/repo",
      }),
    /absolute path/,
  );
  assert.throws(
    () =>
      resolveCanaryPlanPath({
        argument: "/repo/private/plan.json",
        repositoryRoot: "/repo",
        existsSync: () => true,
        realpathSync: (value) => value,
      }),
    /outside the repository/,
  );
  assert.equal(
    resolveCanaryPlanPath({
      argument: "/secure/plan.json",
      repositoryRoot: "/repo",
      existsSync: () => true,
      realpathSync: (value) => value,
    }),
    pathForPlatform("/secure/plan.json"),
  );
});

function pathForPlatform(value) {
  return process.platform === "win32" ? `C:${value.replaceAll("/", "\\")}` : value;
}
