import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("4ページ漫画のネームをDBへ保存できる制約へ更新する", async () => {
  const migration = await readFile(
    "supabase/migrations/202609140002_cloud_storyboard_short_page_count.sql",
    "utf8",
  );
  assert.match(migration, /jsonb_array_length\(result->'pages'\) between 4 and 48/);
  assert.doesNotMatch(migration, /delete from public\.cloud_story_storyboard_versions/i);
});

test("rollbackは短編ネームが存在する場合にデータを消さず停止する", async () => {
  const rollback = await readFile(
    "supabase/rollbacks/202609140002_cloud_storyboard_short_page_count.sql",
    "utf8",
  );
  assert.match(rollback, /cloud_storyboard_short_page_count_rollback_requires_no_short_storyboards/);
  assert.match(rollback, /jsonb_array_length\(result->'pages'\) between 8 and 48/);
  assert.doesNotMatch(rollback, /delete from public\.cloud_story_storyboard_versions/i);
});

test("canonical schemaも4ページ短編ネームを許可する", async () => {
  const schema = await readFile("supabase/schema.sql", "utf8");
  assert.match(schema, /jsonb_array_length\(result->'pages'\) between 4 and 48/);
});
