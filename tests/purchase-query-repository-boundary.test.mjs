import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("purchase history presentation authenticates before repository access", async () => {
  const page = await read("src/app/dashboard/purchases/page.tsx");
  const pageStart = page.indexOf("export default async function PurchasesPage");

  assert.match(page, /purchase-query-repository/);
  assert.doesNotMatch(page, /createAdminClient|@\/lib\/supabase\/admin/);
  assert.ok(pageStart >= 0);
  assert.ok(
    page.indexOf("await requireProfile()", pageStart) <
      page.indexOf("listPurchaseHistoryForProfile(profile.id)", pageStart),
  );
});

test("purchase history repository preserves owner and query contracts", async () => {
  const repository = await read(
    "src/modules/purchases/infrastructure/purchase-query-repository.ts",
  );

  assert.match(repository, /createAdminClient\(\)/);
  assert.match(repository, /\.from\("orders"\)/);
  assert.match(
    repository,
    /id,amount,status,paid_at,download_count,digital_products:product_id\(title,file_url,works:work_id\(title\)\)/,
  );
  assert.match(repository, /\.eq\("buyer_profile_id", profileId\)/);
  assert.match(repository, /\.in\("status", \["paid", "refunded"\]\)/);
  assert.match(
    repository,
    /\.order\("paid_at", \{ ascending: false \}\)/,
  );
});

test("purchase history keeps the existing download route and empty state", async () => {
  const page = await read("src/app/dashboard/purchases/page.tsx");

  assert.match(page, /`\/api\/purchases\/\$\{purchase\.id\}\/download`/);
  assert.match(page, /purchase\.status === "paid"/);
  assert.match(page, /purchase\.digital_products\?\.file_url/);
  assert.match(page, /購入履歴はありません。/);
});
