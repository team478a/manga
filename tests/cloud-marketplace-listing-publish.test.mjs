import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Cloud出品確定は所有する一般作品・固定完成版・単一商品を原子的に検証する", async () => {
  const sql = await read("supabase/migrations/202609290001_cloud_marketplace_listing_publish.sql");

  assert.match(sql, /create or replace function public\.publish_cloud_marketplace_listing/);
  assert.match(sql, /security definer set search_path=public,pg_temp/);
  assert.match(sql, /work\.creator_id=v_profile_id and work\.source_project_id=p_project_id/);
  assert.match(sql, /v_work\.content_class<>'general'/);
  assert.match(sql, /v_work\.current_publication_id is null/);
  assert.match(sql, /v_count<>v_publication\.page_count/);
  assert.match(sql, /nullif\(trim\(v_product\.file_url\),''\) is null/);
  assert.match(sql, /v_product\.file_url<>v_publication\.pdf_storage_path/);
  assert.match(sql, /select count\(\*\) into v_count from public\.digital_products/);
  assert.match(sql, /update public\.works set is_public=true,status='published'/);
  assert.match(sql, /update public\.digital_products set status='active'/);
  assert.match(sql, /revoke all on function public\.publish_cloud_marketplace_listing\(uuid\) from public,anon/);
  assert.match(sql, /grant execute on function public\.publish_cloud_marketplace_listing\(uuid\) to authenticated,service_role/);
});

test("Creator画面からCloud出品を確認付きで開始・再開し確認画面へ進める", async () => {
  const [page, actions, marketplace] = await Promise.all([
    read("src/app/creator/[projectId]/page.tsx"),
    read("src/app/creator/actions.ts"),
    read("src/lib/cloud-marketplace.ts"),
  ]);

  assert.match(page, /publishCloudMarketplaceListingAction/);
  assert.match(page, /作品公開と販売開始・再開をまとめて確定/);
  assert.match(page, /出品を開始・再開する/);
  assert.match(page, /一般公開と新規販売を開始・再開することを確認しました/);
  assert.match(page, /marketplaceDraft\.work\?\.current_publication_id/);
  assert.match(actions, /z\.literal\("publish"\)/);
  assert.match(actions, /publishCloudMarketplaceListing\(parsed\.data\.projectId\)/);
  assert.match(actions, /作品公開と商品販売を開始・再開しました/);
  assert.match(actions, /revalidatePath\("\/works"\)/);
  assert.match(actions, /revalidatePath\(`\/checkout\/\$\{result\.productId\}`\)/);
  assert.match(marketplace, /\.rpc\("publish_cloud_marketplace_listing"/);
  assert.match(page, /作品設定を確認/);
  assert.match(page, /販売商品を確認/);
});

test("Cloud出品確定rollbackは追加RPCだけを除去する", async () => {
  const rollback = await read("supabase/rollbacks/202609290001_cloud_marketplace_listing_publish.sql");
  assert.match(rollback, /^begin;/);
  assert.match(rollback, /drop function if exists public\.publish_cloud_marketplace_listing\(uuid\)/);
  assert.match(rollback, /commit;/);
});
