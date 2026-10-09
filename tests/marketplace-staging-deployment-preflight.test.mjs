import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assessMarketplaceStagingDeployment,
  parseEnvironmentFile,
  resolveCandidateEnvironmentPath,
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

const targetScopedMetadata = (target, keys, type = "encrypted") =>
  keys.map((key) => ({ key, type, target: [target] }));

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
  assert.ok(report.checks.every((check) => check.missingSettings.length === 0));
  assert.deepEqual(report.safety, {
    environmentValuesPrinted: false,
    productionMutation: false,
    stripeRequest: false,
    paymentCreated: false,
  });
});

test("不足設定名だけをtarget付きで報告し値を含めない", () => {
  const report = assessMarketplaceStagingDeployment({
    previewEnvironment: {},
    productionEnvironment: {},
  });

  assert.equal(report.passed, false);
  assert.deepEqual(
    report.checks.find((check) => check.id === "supabase-isolation")
      .missingSettings,
    [
      "Preview:NEXT_PUBLIC_SUPABASE_URL",
      "Preview:NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "Preview:SUPABASE_SERVICE_ROLE_KEY",
      "Production:NEXT_PUBLIC_SUPABASE_URL",
      "Production:NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "Production:SUPABASE_SERVICE_ROLE_KEY",
      "Preview:MANGAI_STAGING_PROJECT_REF",
      "Preview:MANGAI_STAGING_PARENT_PROJECT_REF",
    ],
  );
  assert.deepEqual(
    report.checks.find((check) => check.id === "checkout-mode")
      .missingSettings,
    ["Preview:MANGAI_MARKETPLACE_CHECKOUT_MODE"],
  );
  assert.deepEqual(
    report.checks.find((check) => check.id === "stripe-test")
      .missingSettings,
    [
      "Preview:STRIPE_SECRET_KEY",
      "Preview:STRIPE_WEBHOOK_SECRET",
      "Preview:CHECKOUT_CANCEL_SECRET",
    ],
  );
  assert.doesNotMatch(JSON.stringify(report), /sk_test_|whsec_/);
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

test("Sensitive値をpullできない場合はtarget限定metadataと明示refで検証する", () => {
  const input = readyEnvironments();
  delete input.productionEnvironment.NEXT_PUBLIC_SUPABASE_URL;
  delete input.productionEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete input.productionEnvironment.SUPABASE_SERVICE_ROLE_KEY;
  delete input.previewEnvironment.SUPABASE_SERVICE_ROLE_KEY;
  delete input.previewEnvironment.STRIPE_SECRET_KEY;
  delete input.previewEnvironment.STRIPE_WEBHOOK_SECRET;
  delete input.previewEnvironment.CHECKOUT_CANCEL_SECRET;
  input.previewMetadata = [
    ...targetScopedMetadata("preview", [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]),
    ...targetScopedMetadata("preview", [
      "SUPABASE_SERVICE_ROLE_KEY",
    ]),
    ...targetScopedMetadata(
      "preview",
      [
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "CHECKOUT_CANCEL_SECRET",
      ],
      "sensitive",
    ),
  ];
  input.productionMetadata = targetScopedMetadata("production", [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);

  const report = assessMarketplaceStagingDeployment(input);

  assert.equal(report.passed, true);
  assert.ok(report.checks.every((check) => check.ready));
});

test("共有scopeのmetadataや通常型WebhookはSensitive値の代替にしない", () => {
  const input = readyEnvironments();
  delete input.productionEnvironment.NEXT_PUBLIC_SUPABASE_URL;
  delete input.productionEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete input.productionEnvironment.SUPABASE_SERVICE_ROLE_KEY;
  delete input.previewEnvironment.STRIPE_SECRET_KEY;
  delete input.previewEnvironment.STRIPE_WEBHOOK_SECRET;
  delete input.previewEnvironment.CHECKOUT_CANCEL_SECRET;
  input.previewMetadata = [
    ...["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].map(
      (key) => ({ key, type: "encrypted", target: ["production", "preview"] }),
    ),
    ...targetScopedMetadata("preview", ["SUPABASE_SERVICE_ROLE_KEY"]),
    ...targetScopedMetadata("preview", [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "CHECKOUT_CANCEL_SECRET",
    ]),
  ];
  input.productionMetadata = targetScopedMetadata("production", [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);

  const report = assessMarketplaceStagingDeployment(input);

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((check) => check.id === "supabase-isolation").ready,
    false,
  );
  assert.equal(
    report.checks.find((check) => check.id === "stripe-test").ready,
    false,
  );
});

test("取得できたlive keyをSensitive metadataでtest扱いにしない", () => {
  const input = readyEnvironments();
  input.previewEnvironment.STRIPE_SECRET_KEY = fakeLiveSecret;
  input.previewMetadata = targetScopedMetadata(
    "preview",
    ["STRIPE_SECRET_KEY"],
    "sensitive",
  );

  const report = assessMarketplaceStagingDeployment(input);

  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find((check) => check.id === "stripe-test").ready,
    false,
  );
});

test("一部だけ取得できたProduction値の衝突や不正URLをmetadataで隠さない", () => {
  const collision = readyEnvironments();
  delete collision.productionEnvironment.NEXT_PUBLIC_SUPABASE_URL;
  delete collision.productionEnvironment.SUPABASE_SERVICE_ROLE_KEY;
  collision.productionEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    collision.previewEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  collision.previewMetadata = targetScopedMetadata("preview", [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  collision.productionMetadata = targetScopedMetadata("production", [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);

  const invalidUrl = readyEnvironments();
  invalidUrl.productionEnvironment.NEXT_PUBLIC_SUPABASE_URL = "not-a-url";
  delete invalidUrl.productionEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete invalidUrl.productionEnvironment.SUPABASE_SERVICE_ROLE_KEY;
  invalidUrl.previewMetadata = collision.previewMetadata;
  invalidUrl.productionMetadata = collision.productionMetadata;

  assert.equal(assessMarketplaceStagingDeployment(collision).passed, false);
  assert.equal(assessMarketplaceStagingDeployment(invalidUrl).passed, false);
});

test("候補envはrepository外の絶対パスだけを受け入れる", (context) => {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-repository-"),
  );
  const externalRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-candidate-"),
  );
  context.after(() => {
    fs.rmSync(repositoryRoot, { recursive: true, force: true });
    fs.rmSync(externalRoot, { recursive: true, force: true });
  });

  const internalFile = path.join(repositoryRoot, "preview.env");
  const externalFile = path.join(externalRoot, "preview.env");
  fs.writeFileSync(internalFile, "A=internal\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.writeFileSync(externalFile, "A=external\n", {
    encoding: "utf8",
    mode: 0o600,
  });

  assert.throws(
    () =>
      resolveCandidateEnvironmentPath({
        argument: internalFile,
        repositoryRoot,
      }),
    /outside the repository/,
  );
  assert.throws(
    () =>
      resolveCandidateEnvironmentPath({
        argument: "preview.env",
        repositoryRoot,
      }),
    /absolute path/,
  );
  assert.equal(
    resolveCandidateEnvironmentPath({
      argument: externalFile,
      repositoryRoot,
    }),
    fs.realpathSync(externalFile),
  );
});
