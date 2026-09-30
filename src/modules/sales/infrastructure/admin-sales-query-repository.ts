import { createClient } from "@/lib/supabase/server";

export type AdminSalesOrderRecord = {
  id: string;
  buyer_email: string;
  amount: number;
  platform_fee: number;
  creator_revenue: number;
  status: string;
  payment_mode: "test" | "live";
  created_at: string;
};

type AdminOrderSummary = Pick<
  AdminSalesOrderRecord,
  "amount" | "status" | "payment_mode"
>;

export async function listAdminSalesOrders() {
  const supabase = await createClient();
  return supabase
    .from("orders")
    .select(
      "id,buyer_email,amount,platform_fee,creator_revenue,status,payment_mode,created_at",
    )
    .order("created_at", { ascending: false })
    .returns<AdminSalesOrderRecord[]>();
}

export async function loadAdminOrderMetrics() {
  const supabase = await createClient();
  const [countResult, ordersResult] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("amount,status,payment_mode")
      .returns<AdminOrderSummary[]>(),
  ]);

  if (countResult.error) throw countResult.error;
  if (ordersResult.error) throw ordersResult.error;

  return {
    orderCount: countResult.count ?? 0,
    livePaidTotal: (ordersResult.data ?? [])
      .filter((order) => order.status === "paid" && order.payment_mode === "live")
      .reduce((sum, order) => sum + order.amount, 0),
  };
}
