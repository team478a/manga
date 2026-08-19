import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("supabase/migrations/202608020002_cloud_general_monitor_quality_feedback.sql");
const rollback = read("supabase/rollbacks/202608020002_cloud_general_monitor_quality_feedback.sql");
const api = read("src/app/api/creator/quality-feedback/route.ts");
const form = read("src/app/creator/[projectId]/pages/[pageId]/MonitorQualityFeedback.tsx");
const editor = read("src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx");
const admin = read("src/app/admin/general-monitors/page.tsx");

test("quality feedback migration preserves monitor and project boundaries", () => {
  assert.match(migration, /target_scope in\('general','page','panel'\)/);
  assert.match(migration, /public\.cloud_project_can_edit\(project_id\)/);
  assert.match(migration, /foreign key\(page_id,project_id\)/);
  assert.match(migration, /generation_cost_micros>=0/);
  assert.match(rollback, /drop column if exists target_scope/);
});

test("quality feedback API derives trusted target and generation metrics", () => {
  assert.match(api, /requireCloudGeneralMonitor/);
  assert.match(api, /getCloudPageSnapshot/);
  assert.match(api, /snapshot\.project_id !== input\.projectId/);
  assert.match(api, /snapshot\.canvas\.panels\.find/);
  assert.match(api, /listCloudGenerationJobs/);
  assert.match(api, /generationCostMicros/);
  assert.match(api, /saveMonitorQualityFeedback/);
  assert.doesNotMatch(api, /error\.message/);
});

test("monitor can submit page or selected-panel verdict from the editor", () => {
  assert.match(form, /ページ全体/);
  assert.match(form, /このまま採用できる/);
  assert.match(form, /顔・表情/);
  assert.match(form, /評価を保存中…/);
  assert.match(editor, /selectedPanelId=\{selection\?\.type === "panel"/);
});

test("admin monitor view exposes adoption, revision, provider, cost, and time summaries", () => {
  assert.match(admin, /採用可/);
  assert.match(admin, /要修正/);
  assert.match(admin, /作り直し/);
  assert.match(admin, /1評価あたり生成数/);
  assert.match(admin, /generation_elapsed_ms/);
});
