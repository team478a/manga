import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { checkCloudMangaAcceptance } from "../scripts/check-cloud-manga-acceptance.mjs";

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-value",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
  NEXT_PUBLIC_SITE_URL: "https://app.example.com",
  MONITOR_INVITE_SITE_URL: "https://app.example.com",
  CLOUD_GENERAL_MONITOR_BETA_ENABLED: "true",
  CLOUD_RESEARCH_MVP_ENABLED: "true",
  CLOUD_PROPOSAL_GENERATION_ENABLED: "true",
  CLOUD_SCENARIO_GENERATION_ENABLED: "true",
  CLOUD_STORYBOARD_GENERATION_ENABLED: "true",
  CLOUD_STORYBOARD_CANVAS_ENABLED: "true",
  CLOUD_PANEL_IMAGE_GENERATION_ENABLED: "true",
  MANGAI_CLOUD_AI_WORKER_ENABLED: "true",
  MANGAI_CLOUD_AI_WORKER_SECRET: "w".repeat(32),
  CLOUD_ADULT_RESEARCH_ENABLED: "false",
  CLOUD_ADULT_PLANNING_ENABLED: "false",
};

test("漫画制作preflightは実装・環境・可変幅構造をまとめて確認する", () => {
  const report = checkCloudMangaAcceptance({ env: validEnvironment });
  assert.equal(report.repositoryPassed, true);
  assert.equal(report.environmentPassed, true);
  assert.equal(report.passed, true);
  assert.equal(report.manual.length, 5);
});

test("漫画制作preflightはWorker停止時にfail closedする", () => {
  const report = checkCloudMangaAcceptance({
    env: { ...validEnvironment, MANGAI_CLOUD_AI_WORKER_ENABLED: "false" },
  });
  assert.equal(report.environmentPassed, false);
  assert.equal(report.passed, false);
  assert.equal(
    checkCloudMangaAcceptance({ env: {}, repositoryOnly: true }).passed,
    true,
  );
});

test("漫画制作preflightは秘密値を標準出力へ表示しない", () => {
  const secret = "do-not-print-this-worker-secret-123456789";
  const result = spawnSync(
    process.execPath,
    ["scripts/check-cloud-manga-acceptance.mjs", "--repository-only"],
    {
      cwd: process.cwd(),
      env: { ...process.env, MANGAI_CLOUD_AI_WORKER_SECRET: secret },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(secret));
  assert.match(result.stdout, /Credential values are never printed/);
  assert.match(result.stdout, /Cloud manga acceptance preflight: PASS/);
});
