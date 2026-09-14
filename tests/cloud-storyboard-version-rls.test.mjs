import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/202609140001_cloud_storyboard_version_rls.sql", import.meta.url),
  "utf8",
);
const schema = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

test("storyboard version RLS qualifies scenario and parent references", () => {
  for (const sql of [migration, schema]) {
    assert.match(sql, /scenario\.id\s*=\s*cloud_story_storyboard_versions\.scenario_version_id/);
    assert.match(sql, /parent\.id\s*=\s*cloud_story_storyboard_versions\.parent_version_id/);
    assert.match(sql, /parent\.scenario_version_id\s*=\s*cloud_story_storyboard_versions\.scenario_version_id/);
    assert.doesNotMatch(sql, /scenario\.id\s*=\s*scenario\.scenario_version_id/);
    assert.doesNotMatch(sql, /parent\.id\s*=\s*parent\.parent_version_id/);
  }
});

test("storyboard version RLS retains latest adopted scenario guard", () => {
  for (const sql of [migration, schema]) {
    assert.match(sql, /adoption\.scenario_version_id\s*=\s*scenario\.id/);
    assert.match(sql, /newer\.proposal_selection_id\s*=\s*adoption\.proposal_selection_id/);
    assert.match(sql, /\(newer\.adopted_at,\s*newer\.id\)\s*>\s*\(adoption\.adopted_at,\s*adoption\.id\)/);
  }
});
