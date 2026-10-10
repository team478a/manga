import { createClient } from "@/lib/supabase/server";

export type SalesOrderRecord = {
  id: string;
  buyer_email: string;
  amount: number;
  platform_fee: number;
  creator_revenue: number;
  status: string;
  payment_mode: "test" | "live";
  created_at: string;
  paid_at: string | null;
  updated_at: string;
  digital_products: {
    id: string;
    title: string;
    works: { id: string; title: string } | null;
  } | null;
};

export async function listSalesOrdersForCreator(profileId: string) {
  const supabase = await createClient();
  return supabase
    .from("orders")
    .select(
      "id,buyer_email,amount,platform_fee,creator_revenue,status,payment_mode,created_at,paid_at,updated_at,digital_products:product_id(id,title,works:work_id(id,title))",
    )
    .eq("creator_id", profileId)
    .order("created_at", { ascending: false })
    .returns<SalesOrderRecord[]>();
}
