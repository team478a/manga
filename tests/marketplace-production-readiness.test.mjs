import assert from "node:assert/strict";
import test from "node:test";
import { assessMarketplaceProductionReadiness } from "../scripts/check-marketplace-production-readiness.mjs";

const fakeLiveSecret = [
  "sk",
  "live",
  "0123456789abcdefghijklmnop",
].join("_");
const fakeTestSecret = [
  "sk",
  "test",
  "0123456789abcdefghijklmnop",
].join("_");

const readyEnvironment = () => ({
  NEXT_PUBLIC_SUPABASE_URL: "https://production-parent-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "production-anon-key-value",
  SUPABASE_SERVICE_ROLE_KEY: "production-service-role-key-value",
  NEXT_PUBLIC_SITE_URL: "https://app.mang-ai.com",
  MANGAI_MARKETPLACE_CHECKOUT_MODE: "live",
  STRIPE_SECRET_KEY: fakeLiveSecret,
  STRIPE_WEBHOOK_SECRET: "whsec_0123456789abcdefghijklmnop",
  CHECKOUT_CANCEL_SECRET: "cancel_0123456789abcdefghijklmnop",
});

const productionMetadata = () =>
  [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "MANGAI_MARKETPLACE_CHECKOUT_MODE",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "CHECKOUT_CANCEL_SECRET",
  ].map((key) => ({
    key,
    type: [
      "SUPABASE_SERVICE_ROLE_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "CHECKOUT_CANCEL_SECRET",
    ].includes(key)
      ? "sensitive"
      : "encrypted",
    target: ["production"],
  }));

test("Production専用のlive設定が揃った場合だけREADYにする", () => {
  const report = assessMarketplaceProductionReadiness({
    environment: readyEnvironment(),
    metadata: productionMetadata(),
    requireTargetScopedMetadata: true,
  });

  assert.equal(report.passed, true);
  assert.ok(report.checks.every((check) => check.ready));
  assert.deepEqual(report.safety, {
    environmentValuesPrinted: false,
    productionMutation: false,
    stripeRequest: false,
    paymentCreated: false,
  });
});

test("disabledまたはtest設定とStripe test keyを拒否する", () => {
  const disabled = readyEnvironment();
  disabled.MANGAI_MARKETPLACE_CHECKOUT_MODE = "disabled";
  const testMode = readyEnvironment();
  testMode.MANGAI_MARKETPLACE_CHECKOUT_MODE = "test";
  testMode.STRIPE_SECRET_KEY = fakeTestSecret;

  const disabledReport = assessMarketplaceProductionReadiness({
    environment: disabled,
  });
  const testReport = assessMarketplaceProductionReadiness({
    environment: testMode,
  });

  assert.equal(disabledReport.passed, false);
  assert.equal(testReport.passed, false);
  assert.equal(
    testReport.checks.find((check) => check.id === "checkout-live").ready,
    false,
  );
  assert.equal(
    testReport.checks.find((check) => check.id === "stripe-live").ready,
    false,
  );
});

test("Productionの誤originとStaging marker混入を拒否する", () => {
  const environment = readyEnvironment();
  environment.NEXT_PUBLIC_SITE_URL = "https://preview.example.com/path";
  environment.MANGAI_STAGING_PROJECT_REF = "preview-branch-ref";

  const report = assessMarketplaceProductionReadiness({ environment });

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((check) => check.id === "production-origin").ready,
    false,
  );
  assert.equal(
    report.checks.find((check) => check.id === "production-supabase").ready,
    false,
  );
});

test("Preview共有scopeとbranch限定変数をProduction専用と認めない", () => {
  const metadata = productionMetadata();
  metadata.find((entry) => entry.key === "STRIPE_SECRET_KEY").target = [
    "production",
    "preview",
  ];
  metadata.find((entry) => entry.key === "STRIPE_WEBHOOK_SECRET").gitBranch =
    "release-test";

  const report = assessMarketplaceProductionReadiness({
    environment: readyEnvironment(),
    metadata,
    requireTargetScopedMetadata: true,
  });

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((check) => check.id === "production-scope").ready,
    false,
  );
});

test("server秘密情報がSensitive型でなければProduction専用と認めない", () => {
  const metadata = productionMetadata();
  metadata.find((entry) => entry.key === "STRIPE_SECRET_KEY").type =
    "encrypted";

  const report = assessMarketplaceProductionReadiness({
    environment: readyEnvironment(),
    metadata,
    requireTargetScopedMetadata: true,
  });

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((check) => check.id === "production-scope").ready,
    false,
  );
});

test("Supabase資格情報の欠落・同一値・不正URLを拒否する", () => {
  const missing = readyEnvironment();
  delete missing.SUPABASE_SERVICE_ROLE_KEY;
  const collision = readyEnvironment();
  collision.SUPABASE_SERVICE_ROLE_KEY =
    collision.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const invalidUrl = readyEnvironment();
  invalidUrl.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";

  assert.equal(
    assessMarketplaceProductionReadiness({ environment: missing }).passed,
    false,
  );
  assert.equal(
    assessMarketplaceProductionReadiness({ environment: collision }).passed,
    false,
  );
  assert.equal(
    assessMarketplaceProductionReadiness({ environment: invalidUrl }).passed,
    false,
  );
});

test("結果へ秘密値を含めない", () => {
  const environment = readyEnvironment();
  const report = assessMarketplaceProductionReadiness({ environment });
  const serialized = JSON.stringify(report);

  assert.doesNotMatch(serialized, /sk_live_|whsec_|service-role-key|anon-key/);
});

test("期待origin自体が不正なら一致扱いにしない", () => {
  const environment = readyEnvironment();
  environment.NEXT_PUBLIC_SITE_URL = "not-a-url";

  const report = assessMarketplaceProductionReadiness({
    environment,
    expectedOrigin: "also-not-a-url",
  });

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((check) => check.id === "production-origin").ready,
    false,
  );
});
