import assert from "node:assert/strict";
import test from "node:test";
import {
  assessMarketplaceStagingDeployment,
  parseEnvironmentFile,
} from "../scripts/check-marketplace-staging-deployment.mjs";

const fakeTestSecret = ["sk", "test", "0123456789abcdefghijklmnop"].join(
  "_",
);
const fakeLiveSecret = ["sk", "live", "0123456789abcdefghijklmnop"].join(
  "_",
);

const readyEnvironments = () => ({
  previewEnvironment: {
    NEXT_PUBLIC_SUPABASE_URL: "https://preview-branch-ref.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "preview-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "preview-service-role-key",
    MANGAI_STAGING_PROJECT_REF: "preview-branch-ref",
    MANGAI_STAGING_PARENT_PROJECT_REF: "production-parent-ref",
    MANGAI_MARKETPLACE_CHECKOUT_MODE: "test",
    STRIPE_SECRET_KEY: fakeTestSecret,
    STRIPE_WEBHOOK_SECRET: "whsec_0123456789abcdefghijklmnop",
    CHECKOUT_CANCEL_SECRET: "cancel_0123456789abcdefghijklmnop",
  },
  productionEnvironment: {
    NEXT_PUBLIC_SUPABASE_URL: "https://production-parent-ref.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "production-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "production-service-role-key",
    MANGAI_MARKETPLACE_CHECKOUT_MODE: "disabled",
  },
});

test("Vercel env形式を引用符やexportを含めて解析する", () => {
  assert.deepEqual(
    parseEnvironmentFile(
      'A="https://preview-branch-ref.supabase.co"\nexport B=plain\nC=\'quoted\'\n',
    ),
    {
      A: "https://preview-branch-ref.supabase.co",
      B: "plain",
      C: "quoted",
    },
  );
});

test("隔離SupabaseとStripe test設定が揃った場合だけREADYにする", () => {
  const report = assessMarketplaceStagingDeployment(readyEnvironments());

  assert.equal(report.passed, true);
  assert.ok(report.checks.every((check) => check.ready));
  assert.deepEqual(report.safety, {
    environmentValuesPrinted: false,
    productionMutation: false,
    stripeRequest: false,
    paymentCreated: false,
  });
});

test("PreviewとProductionのSupabase資格情報共有を拒否する", () => {
  const input = readyEnvironments();
  input.previewEnvironment.NEXT_PUBLIC_SUPABASE_URL =
    input.productionEnvironment.NEXT_PUBLIC_SUPABASE_URL;
  input.previewEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    input.productionEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  input.previewEnvironment.SUPABASE_SERVICE_ROLE_KEY =
    input.productionEnvironment.SUPABASE_SERVICE_ROLE_KEY;
  input.previewEnvironment.MANGAI_STAGING_PROJECT_REF =
    "production-parent-ref";

  const report = assessMarketplaceStagingDeployment(input);

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((check) => check.id === "supabase-isolation").ready,
    false,
  );
  assert.doesNotMatch(JSON.stringify(report), /anon-key|service-role-key/);
});

test("Productionのtest modeと不完全なStripe資格情報を拒否する", () => {
  const input = readyEnvironments();
  input.productionEnvironment.MANGAI_MARKETPLACE_CHECKOUT_MODE = "test";
  input.previewEnvironment.STRIPE_SECRET_KEY = fakeLiveSecret;

  const report = assessMarketplaceStagingDeployment(input);

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((check) => check.id === "checkout-mode").ready,
    false,
  );
  assert.equal(
    report.checks.find((check) => check.id === "stripe-test").ready,
    false,
  );
});
