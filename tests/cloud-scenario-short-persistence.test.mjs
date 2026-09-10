import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("4ページ漫画の3シーンをDBへ保存できる制約へ更新する", async () => {
  const migration = await readFile(
    "supabase/migrations/202609100001_cloud_scenario_short_scene_count.sql",
    "utf8",
  );
  assert.match(migration, /jsonb_array_length\(result->'scenes'\) between 3 and 20/);
  assert.doesNotMatch(migration, /delete from public\.cloud_story_scenario_versions/i);
});

test("rollbackは短編シナリオが存在する場合にデータを消さず停止する", async () => {
  const rollback = await readFile(
    "supabase/rollbacks/202609100001_cloud_scenario_short_scene_count.sql",
    "utf8",
  );
  assert.match(rollback, /cloud_scenario_short_scene_count_rollback_requires_no_short_scenarios/);
  assert.match(rollback, /jsonb_array_length\(result->'scenes'\) between 6 and 20/);
  assert.doesNotMatch(rollback, /delete from public\.cloud_story_scenario_versions/i);
});

test("canonical schemaも3シーン短編を許可する", async () => {
  const schema = await readFile("supabase/schema.sql", "utf8");
  assert.match(schema, /jsonb_array_length\(result->'scenes'\) between 3 and 20/);
});
