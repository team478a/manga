import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Cloud商品triggerはauthenticatedの直接作成と固定項目変更を拒否する", async () => {
  const migration = await read("supabase/migrations/202609300001_cloud_marketplace_product_edit_guard.sql");

  assert.match(migration, /current_user='authenticated' and v_new_cloud/);
  assert.match(migration, /v_old_cloud or v_new_cloud/);
  assert.match(migration, /new\.work_id is distinct from old\.work_id/);
  assert.match(migration, /to_jsonb\(new\)->'file_url'/);
  assert.match(migration, /to_jsonb\(old\)->'file_url'/);
  assert.match(migration, /new\.status is distinct from old\.status/);
  assert.match(migration, /old\.status='active' and new\.price is distinct from old\.price/);
  assert.match(migration, /raise exception 'cloud_product_creator_managed'/);
  assert.match(migration, /before insert or update on public\.digital_products/);
});

test("Cloud商品triggerは既存の公開前提チェックを維持する", async () => {
  const [migration, schema] = await Promise.all([
    read("supabase/migrations/202609300001_cloud_marketplace_product_edit_guard.sql"),
    read("supabase/schema.sql"),
  ]);

  for (const source of [migration, schema]) {
    assert.match(source, /new\.status='active'/);
    assert.match(source, /work\.current_publication_id is null/);
    assert.match(source, /not work\.is_public/);
    assert.match(source, /work\.status<>'published'/);
    assert.match(source, /cloud_product_publication_required/);
  }
});

test("正規RPCはsecurity definerのままDBガードと分離される", async () => {
  const [publish, withdrawal, publication] = await Promise.all([
    read("supabase/migrations/202609290001_cloud_marketplace_listing_publish.sql"),
    read("supabase/migrations/202609290002_cloud_marketplace_listing_withdrawal.sql"),
    read("supabase/migrations/202608140004_cloud_work_publications.sql"),
  ]);

  assert.match(publish, /security definer set search_path=public,pg_temp/);
  assert.match(withdrawal, /security definer set search_path=public,pg_temp/);
  assert.match(publication, /sync_cloud_marketplace_release_draft[\s\S]*security definer/);
  assert.match(publication, /select_cloud_work_publication[\s\S]*security definer/);
});

test("rollbackは従来のstatus・work公開前提triggerだけへ戻す", async () => {
  const rollback = await read("supabase/rollbacks/202609300001_cloud_marketplace_product_edit_guard.sql");

  assert.match(rollback, /^begin;/);
  assert.match(rollback, /update of status,work_id on public\.digital_products/);
  assert.doesNotMatch(rollback, /cloud_product_creator_managed/);
  assert.doesNotMatch(rollback, /before insert or update on public\.digital_products/);
  assert.match(rollback, /commit;/);
});
