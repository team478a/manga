import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("external review is atomic and creates only a paused immutable product", async () => {
  const [migration, ownerActions, adminActions, adminPage] = await Promise.all([
    read("supabase/migrations/202610100004_external_submission_review_publish.sql"),
    read("src/app/dashboard/external-submissions/actions.ts"),
    read("src/app/admin/external-submissions/actions.ts"),
    read("src/app/admin/external-submissions/page.tsx"),
  ]);
  assert.match(migration, /submit_external_work_for_review/);
  assert.match(migration, /review_external_work_submission/);
  assert.match(migration, /not public\.is_admin\(\)/);
  assert.match(migration, /'paused',p_submission_id/);
  assert.match(migration, /external_listing_product_immutable/);
  assert.match(migration, /v_submission\.asking_price/);
  assert.match(ownerActions, /submit_external_work_for_review/);
  assert.match(adminActions, /review_external_work_submission/);
  assert.match(adminPage, /固定版と停止中商品を作成し承認/);
});

test("external publish, withdrawal, and admin stop are dedicated audited operations", async () => {
  const [migration, ownerPage, adminPage] = await Promise.all([
    read("supabase/migrations/202610100004_external_submission_review_publish.sql"),
    read("src/app/dashboard/external-submissions/[submissionId]/page.tsx"),
    read("src/app/admin/external-submissions/page.tsx"),
  ]);
  for (const fn of [
    "publish_external_marketplace_listing",
    "withdraw_external_marketplace_listing",
    "stop_external_marketplace_listing",
  ]) assert.match(migration, new RegExp(fn));
  assert.match(migration, /update public\.digital_products set status='paused'[\s\S]+update public\.works set is_public=false/);
  assert.match(migration, /'listing_published'/);
  assert.match(migration, /'listing_withdrawn'/);
  assert.match(migration, /'admin_stopped'/);
  assert.match(migration, /external_submission_notifications/);
  assert.match(ownerPage, /購入済みの読書権限は維持/);
  assert.match(adminPage, /管理者停止/);
});

test("checkout revalidates the external approval graph before order and Stripe session", async () => {
  const [action, checkout] = await Promise.all([
    read("src/app/actions/checkout-actions.ts"),
    read("src/lib/checkout.ts"),
  ]);
  for (const source of [action, checkout]) {
    assert.match(source, /external_work_submissions/);
    assert.match(source, /externalListing\.status !== "published"/);
    assert.match(source, /externalListing\.product_id/);
    assert.match(source, /externalListing\.publication_id/);
    assert.match(source, /external_seller_profiles/);
    assert.match(source, /status !== "eligible"/);
  }
});

test("rollback fails closed when review/publication data exists", async () => {
  const rollback = await read("supabase/rollbacks/202610100004_external_submission_review_publish.sql");
  assert.match(rollback, /external_submission_review_publish_rollback_requires_empty_data/);
  assert.match(rollback, /product_id is not null/);
  assert.match(rollback, /external_submission_notifications/);
});
