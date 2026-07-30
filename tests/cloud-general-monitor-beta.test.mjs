import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkCloudGeneralMonitorBetaEnvironment } from "../scripts/check-cloud-general-monitor-beta-preflight.mjs";

test("一般向けモニターFeature Flagは未設定時fail closedする", async () => {
  const source = await readFile(new URL("../src/lib/cloud-general-monitor.ts", import.meta.url), "utf8");
  assert.match(source, /CLOUD_GENERAL_MONITOR_BETA_ENABLED\?\.toLowerCase\(\) === "true"/);
});

test("管理画面もFeature Flag停止中はDB参照と招待操作を閉じる", async () => {
  const [listPage, detailPage, actions] = await Promise.all([
    readFile(new URL("../src/app/admin/general-monitors/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/users/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/users/[id]/general-monitor-actions.ts", import.meta.url), "utf8"),
  ]);
  assert.match(listPage, /if \(!cloudGeneralMonitorBetaEnabled\(\)\)/);
  assert.match(detailPage, /if \(generalMonitorEnabled\)/);
  assert.match(actions, /if \(!cloudGeneralMonitorBetaEnabled\(\)\)/);
});

test("migrationは本人限定・期限・AI上限・管理者停止を強制する", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202607300006_cloud_general_monitor_beta.sql", import.meta.url), "utf8");
  assert.match(sql, /owner_profile_id=public\.current_profile_id\(\)/);
  assert.match(sql, /expires_at>now\(\)/);
  assert.match(sql, /ai_requests_used<enrollment\.ai_request_limit/);
  assert.match(sql, /stop_cloud_general_monitor/);
  assert.doesNotMatch(sql, /stripe|adult/i);
});

test("一般向け各AI実行前にモニター上限を消費する", async () => {
  const files = [
    "../src/app/dashboard/research/actions.ts",
    "../src/app/dashboard/research/[reportId]/proposal/actions.ts",
    "../src/app/dashboard/research/[reportId]/proposal/scenario/actions.ts",
    "../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/actions.ts",
    "../src/lib/cloud-panel-image-generation-server.ts",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /consumeCloudGeneralMonitorAiRequest/);
  }
});

test("preflightは値を表示せず一般Flagと成人向け停止を確認する", () => {
  const enabled = [
    "CLOUD_GENERAL_MONITOR_BETA_ENABLED", "CLOUD_RESEARCH_MVP_ENABLED",
    "CLOUD_PROPOSAL_GENERATION_ENABLED", "CLOUD_SCENARIO_GENERATION_ENABLED",
    "CLOUD_STORYBOARD_GENERATION_ENABLED", "CLOUD_STORYBOARD_CANVAS_ENABLED",
    "CLOUD_PANEL_IMAGE_GENERATION_ENABLED",
  ];
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "hidden-value",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "hidden-value",
    SUPABASE_SERVICE_ROLE_KEY: "hidden-value",
    ...Object.fromEntries(enabled.map((key) => [key, "true"])),
    CLOUD_ADULT_RESEARCH_ENABLED: "false",
    CLOUD_ADULT_PLANNING_ENABLED: "false",
  };
  const result = checkCloudGeneralMonitorBetaEnvironment(env);
  assert.equal(result.passed, true);
  assert.equal(JSON.stringify(result).includes("hidden-value"), false);
});
