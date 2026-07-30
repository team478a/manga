import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("成人向けAIシナリオFeature Flagは明示的trueだけを許可する", async () => {
  const source = await readFile(new URL("../src/lib/cloud-adult-scenario.ts", import.meta.url), "utf8");
  assert.match(source, /CLOUD_ADULT_SCENARIO_GENERATION_ENABLED\?\.toLowerCase\(\) === "true"/);
});

test("成人向けAIシナリオmigrationは専用許可・同意・Kill Switch・区分RLSを要求する", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202607300007_cloud_adult_scenario.sql", import.meta.url), "utf8");
  assert.match(sql, /adult_scenario/);
  assert.match(sql, /cloud_adult_scenario_settings/);
  assert.match(sql, /cloud_adult_scenario_consents/);
  assert.match(sql, /adult-ai-scenario-v1/);
  assert.match(sql, /can_use_cloud_adult_scenario/);
  assert.match(sql, /selection\.content_class = cloud_story_scenario_versions\.content_class/);
  assert.match(sql, /parent\.content_class = cloud_story_scenario_versions\.content_class/);
  assert.match(sql, /scenario\.content_class = 'general'/);
});

test("成人向けシナリオは区分を維持して成人向けネーム工程へ進む", async () => {
  const detail = await readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/page.tsx", import.meta.url), "utf8");
  const actions = await readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/actions.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /成人向けAIネームへ進む/);
  assert.match(actions, /getCloudAdultStoryboardAccess/);
  assert.match(page, /getCloudAdultStoryboardAccess/);
});
