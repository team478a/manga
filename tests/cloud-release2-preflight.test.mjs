import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { checkCloudRelease2Environment } from "../scripts/check-cloud-release2-preflight.mjs";

const execFileAsync = promisify(execFile);
const script = fileURLToPath(
  new URL("../scripts/check-cloud-release2-preflight.mjs", import.meta.url),
);
const secret = "release2-server-secret-value-not-for-output";
const environment = {
  CLOUD_RESEARCH_MVP_ENABLED: "true",
  CLOUD_PROPOSAL_GENERATION_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://release2.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_release2_test_key",
  NEXT_PUBLIC_SITE_URL: "https://release2.example.jp",
  CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED: "false",
  CLOUD_RESEARCH_SEARCH_ENABLED: "false",
  CLOUD_ADULT_RESEARCH_ENABLED: "false",
  CLOUD_ADULT_PLANNING_ENABLED: "false",
  SUPABASE_SERVICE_ROLE_KEY: secret,
  CLOUD_AI_RATE_LIMIT_SECRET: secret,
};

test("Release 2 preflightは市場分析と企画提案の限定公開設定を確認する", () => {
  const report = checkCloudRelease2Environment(environment);
  assert.equal(report.passed, true);
  assert.equal(
    report.checks.find(
      (check) => check.name === "CLOUD_PROPOSAL_GENERATION_ENABLED",
    )?.status,
    "PASS",
  );
  assert.equal(
    report.checks.find((check) => check.name === "OPENAI_RUNTIME_CONFIG")
      ?.status,
    "INFO",
  );
});

test("Release 2 preflightは企画提案Flag未設定時にfail closedする", () => {
  const report = checkCloudRelease2Environment({
    ...environment,
    CLOUD_PROPOSAL_GENERATION_ENABLED: undefined,
  });
  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find(
      (check) => check.name === "CLOUD_PROPOSAL_GENERATION_ENABLED",
    )?.status,
    "FAIL",
  );
});

test("Release 2 preflightは秘密値を標準出力へ表示しない", async () => {
  const { stdout } = await execFileAsync(process.execPath, [script], {
    env: { ...process.env, ...environment },
    windowsHide: true,
  });
  assert.doesNotMatch(stdout, new RegExp(secret));
  assert.match(stdout, /Release 2 environment preflight: PASS/);
});
