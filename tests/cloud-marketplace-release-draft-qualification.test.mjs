import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("販売下書き同期はRETURNS TABLEのwork_idと実列を衝突させない", async () => {
  const [migration, schema] = await Promise.all([
    read("supabase/migrations/202610030001_cloud_marketplace_release_draft_qualification.sql"),
    read("supabase/schema.sql"),
  ]);

  for (const source of [migration, schema]) {
    const start = source.lastIndexOf(
      "create or replace function public.sync_cloud_marketplace_release_draft(",
    );
    const end = source.indexOf("end$$;", start);
    const functionSql = source.slice(start, end);

    assert.match(functionSql, /#variable_conflict error/);
    assert.match(functionSql, /product\.work_id=v_work_id/);
    assert.match(functionSql, /publication\.work_id=v_work_id/);
    assert.match(functionSql, /where work\.id=v_work_id/);
    assert.doesNotMatch(functionSql, /where work_id=v_work_id/);
  }
});

test("修正migrationは権限契約を維持しrollbackを備える", async () => {
  const [migration, rollback] = await Promise.all([
    read("supabase/migrations/202610030001_cloud_marketplace_release_draft_qualification.sql"),
    read("supabase/rollbacks/202610030001_cloud_marketplace_release_draft_qualification.sql"),
  ]);

  assert.match(migration, /security definer set search_path=public,pg_temp/);
  assert.match(migration, /revoke all on function public\.sync_cloud_marketplace_release_draft/);
  assert.match(migration, /grant execute[^;]*to authenticated,service_role/);
  assert.match(rollback, /create or replace function public\.sync_cloud_marketplace_release_draft/);
});
