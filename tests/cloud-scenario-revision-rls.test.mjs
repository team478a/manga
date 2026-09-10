import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/202609100002_cloud_scenario_revision_rls.sql", import.meta.url),
  "utf8",
);
const schema = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

test("scenario revision RLS qualifies parent and selection references", () => {
  for (const sql of [migration, schema]) {
    assert.match(sql, /selection\.research_report_id\s*=\s*cloud_story_scenario_versions\.research_report_id/);
    assert.match(sql, /parent\.id\s*=\s*cloud_story_scenario_versions\.parent_version_id/);
    assert.match(sql, /parent\.proposal_selection_id\s*=\s*cloud_story_scenario_versions\.proposal_selection_id/);
    assert.doesNotMatch(sql, /parent\.id\s*=\s*parent\.parent_version_id/);
    assert.doesNotMatch(sql, /selection\.research_report_id\s*=\s*selection\.research_report_id/);
  }
});

test("migration preserves the deployed adult scenario guard when available", () => {
  assert.match(migration, /to_regprocedure\('public\.can_use_cloud_adult_scenario\(\)'\)/);
  assert.match(migration, /selection\.content_class\s*=\s*cloud_story_scenario_versions\.content_class/);
  assert.match(migration, /parent\.content_class\s*=\s*cloud_story_scenario_versions\.content_class/);
});
