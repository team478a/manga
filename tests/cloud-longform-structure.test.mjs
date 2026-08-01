import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("long-form migration extends the existing project hierarchy safely", () => {
  const sql = read("supabase/migrations/202608010003_cloud_longform_structure.sql");
  assert.match(sql, /create table if not exists public\.cloud_chapters/);
  assert.match(sql, /create table if not exists public\.cloud_scenes/);
  assert.match(sql, /add column if not exists chapter_id/);
  assert.match(sql, /add column if not exists scene_id/);
  assert.match(sql, /cloud_project_can_edit/);
  assert.match(sql, /move_cloud_page_before/);
  assert.match(sql, /p_page_id=p_target_page_id/);
  assert.match(sql, /v_page\.episode_id<>v_target\.episode_id/);
  assert.match(sql, /'page_reordered'/);
});

test("workspace falls back when the long-form migration is unavailable", () => {
  const service = read("src/modules/cloud-creator/projects/project-service.ts");
  assert.match(service, /structureAvailable/);
  assert.match(service, /available: structureAvailable/);
  assert.match(service, /legacy-\$\{projectId\}/);
  assert.match(service, /章構成（準備中）/);
});

test("32-page board limits initial DOM and supports spreads and drag reorder", () => {
  const component = read("src/app/creator/[projectId]/LongformPageManager.tsx");
  assert.match(component, /const PAGE_BATCH = 12/);
  assert.match(component, /slice\(0, visibleCount\)/);
  assert.match(component, /draggable/);
  assert.match(component, /moveCloudPageBeforeAction/);
  assert.match(component, /単ページ/);
  assert.match(component, /見開き/);
  assert.match(component, /次の\{Math\.min\(PAGE_BATCH/);
});

test("long-form actions validate IDs and keep errors generic", () => {
  const actions = read("src/app/creator/actions.ts");
  assert.match(actions, /addCloudChapterAction/);
  assert.match(actions, /addCloudEpisodeToChapterAction/);
  assert.match(actions, /addCloudSceneAction/);
  assert.match(actions, /addCloudPageToSceneAction/);
  assert.match(actions, /z\.string\(\)\.uuid\(\)/);
  assert.match(actions, /ページを並べ替えできませんでした。/);
});
