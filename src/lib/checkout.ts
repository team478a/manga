import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe";

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
    } | null;
  } | null;
};

export async function createStripeCheckoutSession({
  orderId,
  productId,
  buyerEmail,
  origin
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
  const { data: order } = await supabase
    .from("orders")
    .select("id,buyer_email,product_id,creator_id,amount,status,digital_products:product_id(id,title,description,status,creator_id,works:work_id(id,title,is_public))")
    .eq("id", orderId)
    .eq("product_id", productId)
    .maybeSingle<CheckoutOrder>();

  if (!order || order.status !== "pending") {
    throw new Error("決済準備できる注文が見つかりません。");
  }

  if (order.buyer_email !== buyerEmail) {
    throw new Error("購入者メールアドレスが注文情報と一致しません。");
  }

  if (!order.digital_products || order.digital_products.status !== "active" || !order.digital_products.works?.is_public) {
    throw new Error("この商品は現在購入できません。");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin || "http://localhost:3000";
  const stripe = createStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: buyerEmail,
    line_items: [
      {
        price_data: {
          currency: "jpy",
          product_data: {
            name: order.digital_products.title,
            description: order.digital_products.description ?? undefined
          },
          unit_amount: order.amount
        },
        quantity: 1
      }
    ],
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/checkout/cancel?order_id=${order.id}`,
    metadata: {
      order_id: order.id,
      product_id: order.product_id,
      creator_id: order.creator_id
    },
    payment_intent_data: {
      metadata: {
        order_id: order.id,
        product_id: order.product_id,
        creator_id: order.creator_id
      }
    }
  });

  if (!session.url) {
    throw new Error("Stripe CheckoutのURLを作成できませんでした。");
  }

  return session;
}
