import { createAdminClient } from "@/lib/supabase/admin";

export type CheckoutDownloadOrder = {
  status: string;
  digital_products: { title: string; file_url: string | null } | null;
};

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

export async function getPaidCheckoutDownload(input: {
  orderId: string;
  productId: string;
}) {
  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("status,digital_products:product_id(title,file_url)")
    .eq("id", input.orderId)
    .eq("product_id", input.productId)
    .eq("status", "paid")
    .maybeSingle<CheckoutDownloadOrder>();

  if (!order?.digital_products?.file_url) {
    return { order, signedUrl: null };
  }

  const { data } = await supabase.storage
    .from("digital-products")
    .createSignedUrl(order.digital_products.file_url, 300, {
      download: true,
    });

  return { order, signedUrl: data?.signedUrl ?? null };
}

export function cancelPendingCheckoutOrder(orderId: string) {
  return createAdminClient()
    .from("orders")
    .update({ status: "canceled" })
    .eq("id", orderId)
    .eq("status", "pending");
}
