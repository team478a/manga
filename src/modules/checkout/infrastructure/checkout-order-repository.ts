import { createAdminClient } from "@/lib/supabase/admin";

export function insertPendingCheckoutOrder(input: {
  buyerEmail: string;
  buyerProfileId: string | null;
  productId: string;
  creatorId: string;
  amount: number;
  platformFee: number;
  creatorRevenue: number;
}) {
  return createAdminClient()
    .from("orders")
    .insert({
      buyer_email: input.buyerEmail,
      buyer_profile_id: input.buyerProfileId,
      product_id: input.productId,
      creator_id: input.creatorId,
      amount: input.amount,
      platform_fee: input.platformFee,
      creator_revenue: input.creatorRevenue,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();
}
