import { createAdminClient } from "@/lib/supabase/admin";

export type PurchaseHistoryRecord = {
  id: string;
  amount: number;
  status: "paid" | "refunded";
  paid_at: string | null;
  download_count: number;
  payment_mode: "test" | "live";
  publication_id: string | null;
  digital_products: {
    title: string;
    file_url: string | null;
    profiles: { display_name: string } | null;
    works: {
      id: string;
      title: string;
      image_url: string | null;
      current_publication_id: string | null;
    } | null;
  } | null;
};

export async function listPurchaseHistoryForProfile(profileId: string) {
  const admin = createAdminClient();
  const result = await admin
    .from("orders")
    .select(
      "id,amount,status,paid_at,download_count,payment_mode,publication_id,digital_products:product_id(title,file_url,profiles:creator_id(display_name),works:work_id(id,title,image_url,current_publication_id))",
    )
    .eq("buyer_profile_id", profileId)
    .in("status", ["paid", "refunded"])
    .order("paid_at", { ascending: false })
    .returns<PurchaseHistoryRecord[]>();
  if (!result.error || !(
    result.error.code === "42703" || result.error.code === "PGRST204" ||
    result.error.message.includes("publication_id")
  )) return result;
  const legacy = await admin
    .from("orders")
    .select(
      "id,amount,status,paid_at,download_count,payment_mode,digital_products:product_id(title,file_url,profiles:creator_id(display_name),works:work_id(id,title,image_url,current_publication_id))",
    )
    .eq("buyer_profile_id", profileId)
    .in("status", ["paid", "refunded"])
    .order("paid_at", { ascending: false });
  return {
    ...legacy,
    data: (legacy.data ?? []).map((row) => ({
      ...row,
      publication_id: null,
    })) as unknown as PurchaseHistoryRecord[],
  };
}
