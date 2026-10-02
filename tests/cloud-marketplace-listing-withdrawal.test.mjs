import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canReadFixedWorkPublication } from "../src/modules/publication/domain/work-publication-access.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Cloud販売停止は所有作品と単一商品をロックして商品から先に停止する", async () => {
  const sql = await read("supabase/migrations/202609290002_cloud_marketplace_listing_withdrawal.sql");

  assert.match(sql, /create or replace function public\.withdraw_cloud_marketplace_listing/);
  assert.match(sql, /security definer set search_path=public,pg_temp/);
  assert.match(sql, /work\.creator_id=v_profile_id and work\.source_project_id=p_project_id/);
  assert.match(sql, /v_work\.content_class<>'general'/);
  assert.match(sql, /v_work\.current_publication_id is null/);
  assert.match(sql, /select count\(\*\) into v_count from public\.works/);
  assert.match(sql, /select count\(\*\) into v_count from public\.digital_products/);
  const productUpdate = sql.indexOf("update public.digital_products set status='paused'");
  const workUpdate = sql.indexOf("update public.works set is_public=false,status='draft'");
  assert.ok(productUpdate >= 0 && workUpdate > productUpdate);
  assert.match(sql, /revoke all on function public\.withdraw_cloud_marketplace_listing\(uuid\) from public,anon/);
  assert.match(sql, /grant execute on function public\.withdraw_cloud_marketplace_listing\(uuid\) to authenticated,service_role/);
});

test("固定完成版は公開中または所有者または支払済み購入者だけが読める", () => {
  const base = {
    currentPublicationId: "publication-1",
    isPublic: false,
    owner: false,
    purchased: false,
    status: "draft",
  };
  assert.equal(canReadFixedWorkPublication(base), false);
  assert.equal(canReadFixedWorkPublication({ ...base, owner: true }), true);
  assert.equal(canReadFixedWorkPublication({ ...base, purchased: true }), true);
  assert.equal(canReadFixedWorkPublication({ ...base, isPublic: true, status: "published" }), true);
  assert.equal(canReadFixedWorkPublication({ ...base, currentPublicationId: null, owner: true }), false);
});

test("Creator販売停止は確認必須で購入権を維持し購入履歴から本文へ進める", async () => {
  const [page, actions, marketplace, reader, purchases, repository] = await Promise.all([
    read("src/app/creator/[projectId]/page.tsx"),
    read("src/app/creator/actions.ts"),
    read("src/lib/cloud-marketplace.ts"),
    read("src/modules/publication/application/work-publication-service.ts"),
    read("src/app/dashboard/purchases/page.tsx"),
    read("src/modules/purchases/infrastructure/purchase-query-repository.ts"),
  ]);
  assert.match(page, /withdrawCloudMarketplaceListingAction/);
  assert.match(page, /新規販売と一般公開を停止することを確認しました/);
  assert.match(page, /購入済みの閲覧・ダウンロード権は削除しません/);
  assert.match(page, /すでに開かれた決済画面は完了する場合があります/);
  assert.match(actions, /z\.literal\("withdraw"\)/);
  assert.match(actions, /withdrawCloudMarketplaceListing\(parsed\.data\.projectId\)/);
  assert.match(marketplace, /\.rpc\("withdraw_cloud_marketplace_listing"/);
  assert.match(reader, /canReadFixedWorkPublication/);
  assert.match(repository, /works:work_id\(id,title,image_url\)/);
  assert.match(purchases, /\/works\/\$\{work!\.id\}\/read/);
});

test("Cloud販売停止rollbackは追加RPCだけを除去する", async () => {
  const rollback = await read("supabase/rollbacks/202609290002_cloud_marketplace_listing_withdrawal.sql");
  assert.match(rollback, /^begin;/);
  assert.match(rollback, /drop function if exists public\.withdraw_cloud_marketplace_listing\(uuid\)/);
  assert.match(rollback, /commit;/);
});
