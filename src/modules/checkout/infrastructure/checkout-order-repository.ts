import { createAdminClient } from "@/lib/supabase/admin";

export type CheckoutDownloadOrder = {
  status: string;
  digital_products: { title: string; file_url: string | null } | null;
};

export type PendingCheckoutOrderInput = {
  buyerEmail: string;
  buyerProfileId: string | null;
  productId: string;
  creatorId: string;
  amount: number;
  platformFee: number;
  creatorRevenue: number;
  paymentMode: "test" | "live";
};

export function insertPendingCheckoutOrder(input: PendingCheckoutOrderInput) {
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
      payment_mode: input.paymentMode,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();
}

function findReusableLivePendingCheckoutOrder(
  input: PendingCheckoutOrderInput,
) {
  if (input.paymentMode !== "live" || !input.buyerProfileId) {
    return Promise.resolve({ data: null, error: null });
  }

  return createAdminClient()
    .from("orders")
    .select("id")
    .eq("buyer_email", input.buyerEmail)
    .eq("buyer_profile_id", input.buyerProfileId)
    .eq("product_id", input.productId)
    .eq("creator_id", input.creatorId)
    .eq("amount", input.amount)
    .eq("platform_fee", input.platformFee)
    .eq("creator_revenue", input.creatorRevenue)
    .eq("payment_mode", "live")
    .eq("status", "pending")
    .limit(1)
    .maybeSingle<{ id: string }>();
}

export async function createOrReusePendingCheckoutOrder(
  input: PendingCheckoutOrderInput,
) {
  const existing = await findReusableLivePendingCheckoutOrder(input);
  if (existing.error || existing.data) return existing;

  const inserted = await insertPendingCheckoutOrder(input);
  if (!inserted.error || input.paymentMode !== "live") return inserted;

  // A concurrent request may have won the live-order unique-index race.
  // Re-read the exact immutable checkout facts instead of creating another order.
  const recovered = await findReusableLivePendingCheckoutOrder(input);
  return recovered.data ? recovered : inserted;
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
