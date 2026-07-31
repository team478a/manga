import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkCloudAdultMonitorBetaEnvironment } from "../scripts/check-cloud-adult-monitor-beta-preflight.mjs";

test("限定モニターFeature Flagは未設定時fail closedする", async () => {
  const source = await readFile(new URL("../src/lib/cloud-adult-monitor.ts", import.meta.url), "utf8");
  assert.match(source, /CLOUD_ADULT_MONITOR_BETA_ENABLED\?\.toLowerCase\(\) === "true"/);
});

test("限定モニターmigrationは本人限定・期限・上限・一括停止を強制する", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202607300012_cloud_adult_monitor_beta.sql", import.meta.url), "utf8");
  assert.match(sql, /owner_profile_id=public\.current_profile_id\(\)/);
  assert.match(sql, /expires_at>now\(\)/);
  assert.match(sql, /ai_requests_used<enrollment\.ai_request_limit/);
  assert.match(sql, /'adult_planning','adult_ai_planning','adult_scenario','adult_storyboard'/);
  assert.match(sql, /public\.can_use_cloud_adult_monitor\(\) and exists/);
});

test("成人向けの各AI Provider呼出前にモニター上限を消費する", async () => {
  const files = [
    "../src/app/dashboard/research/actions.ts",
    "../src/app/dashboard/research/[reportId]/proposal/actions.ts",
    "../src/app/dashboard/research/[reportId]/proposal/scenario/actions.ts",
    "../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/actions.ts",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /consumeCloudAdultMonitorAiRequest/);
  }
});

test("限定モニターpreflightは値を表示せず全Flagを確認する", () => {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "CLOUD_ADULT_MONITOR_BETA_ENABLED",
    "CLOUD_ADULT_RESEARCH_ENABLED", "CLOUD_ADULT_AI_PLANNING_ENABLED",
    "CLOUD_ADULT_SCENARIO_GENERATION_ENABLED",
    "CLOUD_ADULT_STORYBOARD_GENERATION_ENABLED",
    "CLOUD_ADULT_CANVAS_ENABLED", "CLOUD_ADULT_WORK_MANAGEMENT_ENABLED",
  ];
  const env = Object.fromEntries(keys.map((key) => [key, key.startsWith("CLOUD_") ? "true" : "hidden-value"]));
  const result = checkCloudAdultMonitorBetaEnvironment(env);
  assert.equal(result.passed, true);
  assert.equal(JSON.stringify(result).includes("hidden-value"), false);
});
