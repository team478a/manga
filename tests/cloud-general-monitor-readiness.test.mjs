import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("テスト公開チェックは秘密値を表示せず主要な公開条件を確認する", async () => {
  const [readiness, page] = await Promise.all([
    readFile(
      new URL(
        "../src/lib/cloud-general-monitor-readiness.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/general-monitors/readiness/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  for (const key of [
    "CLOUD_GENERAL_MONITOR_BETA_ENABLED",
    "CLOUD_RESEARCH_MVP_ENABLED",
    "CLOUD_PROPOSAL_GENERATION_ENABLED",
    "CLOUD_SCENARIO_GENERATION_ENABLED",
    "CLOUD_STORYBOARD_GENERATION_ENABLED",
    "CLOUD_STORYBOARD_CANVAS_ENABLED",
    "CLOUD_PANEL_IMAGE_GENERATION_ENABLED",
    "CLOUD_ADULT_RESEARCH_ENABLED",
    "CLOUD_ADULT_PLANNING_ENABLED",
    "MANGAI_CLOUD_AI_WORKER_ENABLED",
    "MANGAI_CLOUD_AI_WORKER_SECRET",
    "NEXT_PUBLIC_SITE_URL",
    "MONITOR_INVITE_SITE_URL",
  ]) {
    assert.match(readiness, new RegExp(key));
  }
  assert.match(readiness, /getCloudGeneralMonitorEmailSettings/);
  assert.match(readiness, /getCloudResearchAiSettings/);
  assert.match(readiness, /getCloudGeneralImageSettings/);
  assert.match(readiness, /cloud_general_monitor_enrollments/);
  assert.match(readiness, /cloud_general_monitor_feedback/);
  assert.doesNotMatch(page, /apiKey|secret_id|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(page, /スタッフ1名/);
  assert.match(page, /2〜3名/);
  assert.match(readiness, /siteOrigin === inviteOrigin/);
  assert.match(page, /テスト公開チェック/);
  assert.match(readiness, /一般向け画像生成AI/);
  assert.match(readiness, /画像生成Worker/);
  assert.match(
    readiness,
    /202607310004_cloud_general_image_provider\.sql/,
  );
  assert.match(readiness, /MANGAI_CLOUD_AI_WORKER_ENABLED=true/);
  assert.match(readiness, /32文字以上のランダム値/);
  assert.match(page, /check\.nextSteps/);
  assert.match(page, /list-decimal/);
});

test("モニター管理とスタッフマニュアルから公開チェックへ移動できる", async () => {
  const files = await Promise.all([
    readFile(
      new URL("../src/app/admin/general-monitors/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/general-monitors/guide/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  for (const source of files)
    assert.match(source, /\/admin\/general-monitors\/readiness/);
});
