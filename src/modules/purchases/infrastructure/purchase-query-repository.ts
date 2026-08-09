import { createAdminClient } from "@/lib/supabase/admin";

export type PurchaseHistoryRecord = {
  id: string;
  amount: number;
  status: "paid" | "refunded";
  paid_at: string | null;
  download_count: number;
  digital_products: {
    title: string;
    file_url: string | null;
    works: { title: string } | null;
  } | null;
};

export function listPurchaseHistoryForProfile(profileId: string) {
  return createAdminClient()
    .from("orders")
    .select(
      "id,amount,status,paid_at,download_count,digital_products:product_id(title,file_url,works:work_id(title))",
    )
    .eq("buyer_profile_id", profileId)
    .in("status", ["paid", "refunded"])
    .order("paid_at", { ascending: false })
    .returns<PurchaseHistoryRecord[]>();
}
