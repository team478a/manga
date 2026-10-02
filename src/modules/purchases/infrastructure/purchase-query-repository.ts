import { createAdminClient } from "@/lib/supabase/admin";

export type PurchaseHistoryRecord = {
  id: string;
  amount: number;
  status: "paid" | "refunded";
  paid_at: string | null;
  download_count: number;
  payment_mode: "test" | "live";
  digital_products: {
    title: string;
    file_url: string | null;
    profiles: { display_name: string } | null;
    works: { id: string; title: string; image_url: string | null } | null;
  } | null;
};

export function listPurchaseHistoryForProfile(profileId: string) {
  return createAdminClient()
    .from("orders")
    .select(
      "id,amount,status,paid_at,download_count,payment_mode,digital_products:product_id(title,file_url,profiles:creator_id(display_name),works:work_id(id,title,image_url))",
    )
    .eq("buyer_profile_id", profileId)
    .in("status", ["paid", "refunded"])
    .order("paid_at", { ascending: false })
    .returns<PurchaseHistoryRecord[]>();
}
