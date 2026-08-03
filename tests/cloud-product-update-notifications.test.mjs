import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("公開済み更新情報は有効なモニターへ重複なく通知される", async () => {
  const migration = await read("../supabase/migrations/202608030003_cloud_product_update_notifications.sql");
  assert.match(migration, /notification_type.*product_update/s);
  assert.match(migration, /enrollment\.status='active'/);
  assert.match(migration, /enrollment\.expires_at>now\(\)/);
  assert.match(migration, /on conflict\(dedupe_key\) do update/);
  assert.match(migration, /delete from public\.cloud_ai_notifications/);
});

test("利用者は更新情報の一覧と詳細を確認できる", async () => {
  const [list, detail, notifications] = await Promise.all([
    read("../src/app/dashboard/updates/page.tsx"),
    read("../src/app/dashboard/updates/[updateId]/page.tsx"),
    read("../src/app/dashboard/notifications/page.tsx"),
  ]);
  assert.match(list, /更新情報/);
  assert.match(detail, /関連画面を開く/);
  assert.match(notifications, /product_update/);
  assert.match(notifications, /dashboard\/updates/);
});

test("管理者は変更メモから公開前の下書きを作成できる", async () => {
  const [actions, admin] = await Promise.all([
    read("../src/app/admin/product-updates/actions.ts"),
    read("../src/app/admin/product-updates/page.tsx"),
  ]);
  assert.match(actions, /createAutomaticProductUpdateDraftAction/);
  assert.match(actions, /published_at: null/);
  assert.match(admin, /変更メモから下書きを自動作成/);
});
