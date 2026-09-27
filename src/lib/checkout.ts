import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe";
import {
  requireMarketplaceCheckoutMode,
  type OrderPaymentMode,
} from "@/lib/checkout-mode";
import {
  assertCheckoutOrder,
  createCheckoutCancelToken,
  normalizeBuyerEmail,
  resolveCheckoutDeploymentOrigin,
} from "@/lib/checkout-policy";
import {
  DomainError,
  isDomainError,
  ProviderUnavailableError,
} from "@/lib/domain-errors";

type CheckoutOrder = {
  id: string;
  buyer_email: string;
  product_id: string;
  creator_id: string;
  amount: number;
  status: string;
  payment_mode: OrderPaymentMode;
  buyer_profile_id: string | null;
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
  paymentMode,
}: {
  orderId: string;
  productId: string;
  buyerEmail: string;
  origin?: string;
  paymentMode?: OrderPaymentMode;
}) {
  const configuredPaymentMode = requireMarketplaceCheckoutMode();
  if (paymentMode && paymentMode !== configuredPaymentMode)
    throw new ProviderUnavailableError(
      "注文の決済環境が現在の販売モードと一致しません。",
    );

  const supabase = createAdminClient();
  const { data: checkoutOrder, error: checkoutOrderError } = await supabase
    .from("orders")
    .select(
      "id,buyer_email,buyer_profile_id,product_id,creator_id,amount,status,payment_mode,digital_products:product_id(id,title,description,status,creator_id,works:work_id(id,title,is_public,content_class))",
    )
    .eq("id", orderId)
    .eq("product_id", productId)
    .maybeSingle<CheckoutOrder>();
  if (checkoutOrderError)
    throw new DomainError(
      "INTERNAL_ERROR",
      "注文情報を確認できませんでした。",
      { cause: checkoutOrderError },
    );

  const order = assertCheckoutOrder(checkoutOrder, {
    orderId,
    productId,
    buyerEmail,
    paymentMode: configuredPaymentMode,
  });
  const normalizedEmail = normalizeBuyerEmail(buyerEmail);
  const siteUrl = resolveCheckoutDeploymentOrigin({
    requestOrigin: origin,
  });
  const cancelSecret =
    process.env.CHECKOUT_CANCEL_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET ||
    "";
  const cancelToken = createCheckoutCancelToken(order.id, cancelSecret);
  const stripe = createStripeClient();
  const buyerMetadata: Record<string, string> = {};
  if (order.buyer_profile_id)
    buyerMetadata.buyer_profile_id = order.buyer_profile_id;
  try {
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
        payment_mode: configuredPaymentMode,
        ...buyerMetadata,
      },
      payment_intent_data: {
        metadata: {
          order_id: order.id,
          product_id: order.product_id,
          creator_id: order.creator_id,
          payment_mode: configuredPaymentMode,
          ...buyerMetadata,
        },
      },
    });
    if (!session.url)
      throw new ProviderUnavailableError(
        "Stripe CheckoutのURLを作成できませんでした。",
      );
    return session;
  } catch (error) {
    if (isDomainError(error)) throw error;
    throw new ProviderUnavailableError(
      "Stripe Checkoutを開始できませんでした。",
    );
  }
}
