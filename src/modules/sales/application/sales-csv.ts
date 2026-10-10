import type { SalesOrderRecord } from "../infrastructure/sales-query-repository.ts";
import { salesAdjustment } from "../domain/sales-operational-report.ts";

function spreadsheetSafeText(value: unknown) {
  const text = value == null ? "" : String(value);
  return typeof value === "string" && /^[\t\r\n ]*[=+\-@]/.test(text)
    ? `'${text}`
    : text;
}

export function salesCsvCell(value: unknown) {
  return `"${spreadsheetSafeText(value).replaceAll('"', '""')}"`;
}

export function buildCreatorSalesCsv(orders: SalesOrderRecord[]) {
  const headers = [
    "注文ID",
    "受付日時",
    "支払日時",
    "最終更新日時",
    "作品ID",
    "作品名",
    "商品ID",
    "商品名",
    "購入者",
    "状態",
    "区分",
    "販売金額（税込円）",
    "返金調整（税込円）",
    "純売上（税込円）",
    "手数料（税込円）",
    "受取予定額（税込円）",
    "精算状態",
  ];
  const rows = orders.map((order) => {
    const adjustment = salesAdjustment(order);
    return [
      order.id,
      order.created_at,
      order.paid_at ?? "",
      order.updated_at,
      order.digital_products?.works?.id ?? "",
      order.digital_products?.works?.title ?? "",
      order.digital_products?.id ?? "",
      order.digital_products?.title ?? "",
      order.buyer_email,
      order.status,
      order.payment_mode,
      adjustment.sales,
      adjustment.refund ? -adjustment.refund : 0,
      adjustment.sales - adjustment.refund,
      adjustment.platformFee,
      adjustment.creatorRevenue,
      "参考表示のみ（精算・送金対象外）",
    ];
  });
  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map(salesCsvCell).join(","))
    .join("\r\n")}`;
}
