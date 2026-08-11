import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/202608110001_profile_admin_rls_recursion.sql",
  import.meta.url,
);
const rollbackUrl = new URL(
  "../supabase/rollbacks/202608110001_profile_admin_rls_recursion.sql",
  import.meta.url,
);

test("profiles RLSのadmin判定はRLS再帰を避ける固定search_pathのdefiner関数で行う", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(
    migration,
    /create or replace function public\.is_admin\(\)[\s\S]+security definer[\s\S]+set search_path = public, pg_temp/,
  );
  assert.match(migration, /user_id = auth\.uid\(\) and role = 'admin'/);
  assert.doesNotMatch(migration, /alter table|create policy|drop policy/i);
});

test("profiles RLS再帰修正は関数実行権限だけを元へ戻せる", async () => {
  const rollback = await readFile(rollbackUrl, "utf8");

  assert.match(rollback, /alter function public\.is_admin\(\) security invoker/);
  assert.match(rollback, /alter function public\.is_admin\(\) reset all/);
});
