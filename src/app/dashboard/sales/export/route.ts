import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { buildCreatorSalesCsv } from "@/modules/sales/application/sales-csv";
import { listSalesOrdersForCreator } from "@/modules/sales/infrastructure/sales-query-repository";

export async function GET() {
  const { profile } = await requireProfile();
  const { data, error } = await listSalesOrdersForCreator(profile.id);
  if (error)
    return new NextResponse("売上CSVを作成できませんでした", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buildCreatorSalesCsv(data ?? []), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mangai-sales-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
