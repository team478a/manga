import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("creator can explicitly accept the versioned external seller terms", async () => {
  const [page, actions, constants] = await Promise.all([
    read("src/app/dashboard/external-submissions/page.tsx"),
    read("src/app/dashboard/external-submissions/actions.ts"),
    read("src/app/dashboard/external-submissions/constants.ts"),
  ]);
  assert.match(constants, /EXTERNAL_SELLER_TERMS_VERSION = "external-seller-v1"/);
  assert.match(actions, /accept_external_seller_terms/);
  assert.match(actions, /termsAccepted/);
  assert.match(page, /出品者規約の確認/);
  assert.match(page, /規約に同意して承認を申請/);
  assert.match(page, /管理者の承認待ちです/);
  assert.match(page, /出品者利用は停止中です/);
});

test("admin cannot submit creator-only external seller terms", async () => {
  const [page, actions] = await Promise.all([
    read("src/app/dashboard/external-submissions/page.tsx"),
    read("src/app/dashboard/external-submissions/actions.ts"),
  ]);
  assert.match(page, /profile\.role !== "creator"/);
  assert.match(page, /管理者アカウントでは出品者規約への同意を記録できません/);
  assert.match(page, /\/admin\/external-submissions/);
  assert.match(actions, /const \{ supabase, profile \} = await cloudCreatorContext\(\)/);
  assert.match(actions, /profile\.role !== "creator"/);
  assert.match(actions, /出品者登録にはcreatorアカウントが必要です/);
});

test("admin can approve or suspend only terms-registered external sellers", async () => {
  const [page, actions, migration] = await Promise.all([
    read("src/app/admin/external-submissions/page.tsx"),
    read("src/app/admin/external-submissions/actions.ts"),
    read("supabase/migrations/202610100001_external_submission_foundation.sql"),
  ]);
  assert.match(page, /external_seller_profiles/);
  assert.match(page, /出品者として承認/);
  assert.match(page, /出品者利用を停止/);
  assert.doesNotMatch(page, /email/);
  assert.match(actions, /set_external_seller_status/);
  assert.match(actions, /z\.enum\(\["draft", "eligible", "suspended"\]\)/);
  assert.match(migration, /external_seller_terms_required/);
  assert.match(migration, /external_seller_admin_required/);
});
