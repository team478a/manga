import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("一般向け画像生成APIキーはVaultへ保存しservice roleだけが復号できる", async () => {
  const [migration, rollback] = await Promise.all([
    readSource(
      "../supabase/migrations/202607310004_cloud_general_image_provider.sql",
    ),
    readSource(
      "../supabase/rollbacks/202607310004_cloud_general_image_provider.sql",
    ),
  ]);
  assert.match(migration, /vault\.create_secret/);
  assert.match(migration, /vault\.update_secret/);
  assert.match(migration, /vault\.decrypted_secrets/);
  assert.match(migration, /black-forest-labs/);
  assert.match(
    migration,
    /revoke all on function public\.get_cloud_general_image_runtime_config\(\)[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_cloud_general_image_runtime_config\(\)[\s\S]*to service_role/,
  );
  assert.doesNotMatch(migration, /api_key\s+text\s+not null/);
  assert.match(
    rollback,
    /cloud_general_image_provider_secret_must_be_removed_before_rollback/,
  );
});

test("管理画面はBFL APIキーを再表示せず一般向け接続として表示する", async () => {
  const page = await readSource("../src/app/admin/cloud-ai/page.tsx");
  assert.match(page, /type="password"/);
  assert.match(page, /imageSettings\.configured/);
  assert.match(page, /成人向け画像はこの接続へ送信されません/);
  assert.doesNotMatch(page, /apiKey\.slice|secret_id/);
});
