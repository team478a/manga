import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("管理者注文画面は認証後に明示列だけをrepositoryから取得する", async () => {
  const [page, repository] = await Promise.all([
    read("src/app/admin/orders/page.tsx"),
    read("src/modules/sales/infrastructure/admin-sales-query-repository.ts"),
  ]);

  assert.ok(page.indexOf("requireAdmin()") < page.indexOf("listAdminSalesOrders()"));
  assert.match(repository, /\.from\("orders"\)/);
  assert.match(repository, /id,buyer_email,amount,platform_fee,creator_revenue,status,payment_mode,created_at/);
  assert.match(repository, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.doesNotMatch(repository, /select\("\*"\)|createAdminClient/);
});

test("管理者注文読込失敗を空一覧として表示しない", async () => {
  const page = await read("src/app/admin/orders/page.tsx");

  assert.match(page, /const \{ data, error \} = await listAdminSalesOrders/);
  assert.match(page, /注文が0件になったわけではありません/);
  assert.match(page, /注文一覧を空として扱わず、読込を停止しました/);
  assert.match(page, /error \? \([\s\S]*注文情報を再読み込み[\s\S]*\) : orders\.length/);
  assert.match(page, /orders\.length[\s\S]*注文はまだありません/);
});

test("管理ダッシュボードは注文指標を取得不能時に0と表示しない", async () => {
  const [page, repository] = await Promise.all([
    read("src/app/admin/page.tsx"),
    read("src/modules/sales/infrastructure/admin-sales-query-repository.ts"),
  ]);

  assert.match(page, /safelyLoadAdminData\("dashboard\/orders", loadAdminOrderMetrics\)/);
  assert.match(page, /orderMetrics\.ok \? orderMetrics\.value\.orderCount : "確認"/);
  assert.match(page, /orderMetrics\.ok \? yen\(orderMetrics\.value\.livePaidTotal\) : "確認"/);
  assert.match(repository, /if \(countResult\.error\) throw countResult\.error/);
  assert.match(repository, /if \(ordersResult\.error\) throw ordersResult\.error/);
  assert.match(repository, /order\.status === "paid" && order\.payment_mode === "live"/);
});
