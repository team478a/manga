import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe";
import {
  assertCheckoutOrder,
  createCheckoutCancelToken,
  normalizeBuyerEmail,
  resolveCheckoutOrigin,
} from "@/lib/checkout-policy";

type CheckoutOrder = {
  id: string;
  buyer_email: string;
  product_id: string;
  creator_id: string;
  amount: number;
  status: string;
  digital_products: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    creator_id: string;
    works: {
      id: string;
      title: string;
      is_public: boolean;
      content_class: "general" | "adult";
    } | null;
  } | null;
};

export async function createStripeCheckoutSession({
  orderId,
  productId,
  buyerEmail,
  origin,
}: {
  orderId: string;
  productId: string;
  buyerEmail: string;
  origin?: string;
}) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripeのシークレットキーが設定されていません。");
  }

  const supabase = createAdminClient();
  const { data: checkoutOrder } = await supabase
    .from("orders")
    .select(
      "id,buyer_email,product_id,creator_id,amount,status,digital_products:product_id(id,title,description,status,creator_id,works:work_id(id,title,is_public,content_class))",
    )
    .eq("id", orderId)
    .eq("product_id", productId)
    .maybeSingle<CheckoutOrder>();

  const order = assertCheckoutOrder(checkoutOrder, {
    orderId,
    productId,
    buyerEmail,
  });
  const normalizedEmail = normalizeBuyerEmail(buyerEmail);
  const siteUrl = resolveCheckoutOrigin({
    configured: process.env.NEXT_PUBLIC_SITE_URL,
    requestOrigin: origin,
    production: process.env.NODE_ENV === "production",
  });
  const cancelSecret =
    process.env.CHECKOUT_CANCEL_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET ||
    "";
  const cancelToken = createCheckoutCancelToken(order.id, cancelSecret);
  const stripe = createStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: normalizedEmail,
    line_items: [
      {
        price_data: {
          currency: "jpy",
          product_data: {
            name: order.digital_products.title,
            description: order.digital_products.description ?? undefined,
          },
          unit_amount: order.amount,
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/checkout/cancel?order_id=${order.id}&cancel_token=${cancelToken}`,
    metadata: {
      order_id: order.id,
      product_id: order.product_id,
      creator_id: order.creator_id,
    },
    payment_intent_data: {
      metadata: {
        order_id: order.id,
        product_id: order.product_id,
        creator_id: order.creator_id,
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe CheckoutのURLを作成できませんでした。");
  }

  return session;
}
