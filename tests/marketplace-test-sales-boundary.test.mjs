import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("テスト注文は注文作成からStripe metadataまで同じmodeを維持する", async () => {
  const [action, repository, checkout, payments] = await Promise.all([
    read("src/app/actions/checkout-actions.ts"),
    read("src/modules/checkout/infrastructure/checkout-order-repository.ts"),
    read("src/lib/checkout.ts"),
    read("src/lib/payments.ts"),
  ]);

  assert.match(action, /requireMarketplaceCheckoutMode\(\)/);
  assert.match(action, /paymentMode,/);
  assert.match(repository, /payment_mode: input\.paymentMode/);
  assert.match(checkout, /payment_mode: configuredPaymentMode/);
  assert.match(payments, /\.eq\("payment_mode", reference\.paymentMode\)/);
});

test("管理者と出品者の売上合計は本番の支払済み注文だけを集計する", async () => {
  const [adminPage, salesPage] = await Promise.all([
    read("src/app/admin/page.tsx"),
    read("src/app/dashboard/sales/page.tsx"),
  ]);

  for (const page of [adminPage, salesPage]) {
    assert.match(page, /order\.status === "paid"/);
    assert.match(page, /order\.payment_mode === "live"/);
  }
  assert.match(adminPage, /テスト購入は含みません/);
  assert.match(salesPage, /テスト購入は受取予定額に含みません/);
});

test("出品者は注文がどの作品・商品に対するものか確認できる", async () => {
  const [salesPage, repository] = await Promise.all([
    read("src/app/dashboard/sales/page.tsx"),
    read("src/modules/sales/infrastructure/sales-query-repository.ts"),
  ]);

  assert.match(
    repository,
    /digital_products:product_id\(title,works:work_id\(title\)\)/,
  );
  assert.match(salesPage, /作品・商品/);
  assert.match(salesPage, /order\.digital_products\?\.works\?\.title/);
  assert.match(salesPage, /order\.digital_products\?\.title/);
});

test("migrationは既存注文をliveとして保ちtestとliveを制約する", async () => {
  const [migration, rollback] = await Promise.all([
    read("supabase/migrations/202609270001_marketplace_test_sales.sql"),
    read("supabase/rollbacks/202609270001_marketplace_test_sales.sql"),
  ]);

  assert.match(migration, /payment_mode text not null default 'live'/);
  assert.match(migration, /payment_mode in \('test', 'live'\)/);
  assert.match(rollback, /marketplace_test_sales_rollback_blocked/);
  assert.match(rollback, /where payment_mode = 'test'/);
});
