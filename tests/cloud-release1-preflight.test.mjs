import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { checkCloudRelease1Environment } from "../scripts/check-cloud-release1-preflight.mjs";

const execFileAsync = promisify(execFile);
const script = fileURLToPath(
  new URL("../scripts/check-cloud-release1-preflight.mjs", import.meta.url),
);

const baseEnvironment = {
  CLOUD_RESEARCH_MVP_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://release1.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_release1_test_key",
  NEXT_PUBLIC_SITE_URL: "https://release1.example.jp",
  CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED: "false",
  CLOUD_RESEARCH_SEARCH_ENABLED: "false",
};

test("Release 1 preflightは最小構成と手動出典入力を許可する", () => {
  const report = checkCloudRelease1Environment(baseEnvironment);
  assert.equal(report.passed, true);
  assert.equal(
    report.checks.find((item) => item.name === "BRAVE_SEARCH_API_KEY")?.status,
    "SKIP",
  );
  assert.equal(
    report.checks.find(
      (item) => item.name === "CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS",
    )?.status,
    "SKIP",
  );
});

test("Release 1 preflightは有効化した任意機能のServer設定を要求する", () => {
  const report = checkCloudRelease1Environment({
    ...baseEnvironment,
    CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED: "true",
    CLOUD_RESEARCH_SEARCH_ENABLED: "true",
  });
  assert.equal(report.passed, false);
  for (const name of [
    "CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS",
    "BRAVE_SEARCH_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CLOUD_RESEARCH_SEARCH_RATE_LIMIT_SECRET",
  ])
    assert.equal(
      report.checks.find((item) => item.name === name)?.status,
      "FAIL",
    );
});

test("Release 1 preflightは秘密値を標準出力へ表示しない", async () => {
  const secret = "release1-secret-value-that-must-not-be-printed";
  const { stdout } = await execFileAsync(process.execPath, [script], {
    env: {
      ...process.env,
      ...baseEnvironment,
      CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED: "true",
      CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS: "www.example.jp",
      CLOUD_RESEARCH_SEARCH_ENABLED: "true",
      BRAVE_SEARCH_API_KEY: secret,
      SUPABASE_SERVICE_ROLE_KEY: secret,
      CLOUD_RESEARCH_SEARCH_RATE_LIMIT_SECRET: secret,
    },
    windowsHide: true,
  });
  assert.doesNotMatch(stdout, new RegExp(secret));
  assert.match(stdout, /Release 1 environment preflight: PASS/);
});

test("Release 1 preflightは未設定Feature Flagをfail closedにする", () => {
  const report = checkCloudRelease1Environment({
    ...baseEnvironment,
    CLOUD_RESEARCH_MVP_ENABLED: undefined,
  });
  assert.equal(report.passed, false);
  assert.equal(
    report.checks.find(
      (item) => item.name === "CLOUD_RESEARCH_MVP_ENABLED",
    )?.status,
    "FAIL",
  );
});
