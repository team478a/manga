import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSalesOperationalReport,
  salesAdjustment,
} from "../src/modules/sales/domain/sales-operational-report.ts";
import {
  buildCreatorSalesCsv,
  salesCsvCell,
} from "../src/modules/sales/application/sales-csv.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("full refunds are explicit deductions and test orders stay out of live operations", () => {
  const report = buildSalesOperationalReport([
    { amount: 1000, platform_fee: 200, creator_revenue: 800, status: "paid", payment_mode: "live" },
    { amount: 500, platform_fee: 100, creator_revenue: 400, status: "refunded", payment_mode: "live" },
    { amount: 300, platform_fee: 60, creator_revenue: 240, status: "paid", payment_mode: "test" },
    { amount: 900, platform_fee: 180, creator_revenue: 720, status: "failed", payment_mode: "live" },
  ], "live");
  assert.deepEqual(report, {
    paidOrderCount: 1,
    refundedOrderCount: 1,
    completedGrossSales: 1500,
    refundedAmount: 500,
    netSales: 1000,
    netPlatformFees: 200,
    netCreatorRevenue: 800,
  });
  assert.deepEqual(salesAdjustment({ amount: 900, platform_fee: 180, creator_revenue: 720, status: "pending", payment_mode: "live" }), {
    sales: 0, refund: 0, platformFee: 0, creatorRevenue: 0,
  });
});

test("creator CSV is BOM encoded, spreadsheet safe, and reflects refunds", () => {
  assert.equal(salesCsvCell("=SUM(A1:A2)"), '"\'=SUM(A1:A2)"');
  const csv = buildCreatorSalesCsv([{
    id: "order-1", buyer_email: "buyer@example.com", amount: 500,
    platform_fee: 100, creator_revenue: 400, status: "refunded",
    payment_mode: "live", created_at: "2026-10-10T00:00:00Z",
    paid_at: "2026-10-10T00:01:00Z", updated_at: "2026-10-10T01:00:00Z",
    digital_products: { id: "product-1", title: "=unsafe", works: { id: "work-1", title: "作品" } },
  }]);
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /販売金額（税込円）/);
  assert.match(csv, /返金調整（税込円）/);
  assert.match(csv, /"500","-500","0","0","0"/);
  assert.match(csv, /"'=unsafe"/);
  assert.doesNotMatch(csv, /stripe_payment_intent_id/);
});

test("sales export stays owner scoped and settlement remains out of scope", async () => {
  const [route, page, repository] = await Promise.all([
    read("src/app/dashboard/sales/export/route.ts"),
    read("src/app/dashboard/sales/page.tsx"),
    read("src/modules/sales/infrastructure/sales-query-repository.ts"),
  ]);
  assert.ok(route.indexOf("requireProfile()") < route.indexOf("listSalesOrdersForCreator(profile.id)"));
  assert.doesNotMatch(route, /createAdminClient/);
  assert.match(route, /Cache-Control.*no-store/s);
  assert.match(repository, /\.eq\("creator_id", profileId\)/);
  assert.match(page, /表示金額は税込です/);
  assert.match(page, /全額返金は元の売上と同額を返金調整として差し引きます/);
  assert.match(page, /部分返金、税額内訳、適格請求書、精算・送金はこのレポートの対象外/);
  assert.match(page, /href="\/dashboard\/sales\/export"/);
});
