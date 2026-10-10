import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe";
import { assertMarketplaceCanaryCheckoutTarget } from "@/lib/checkout-canary";
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
  publication_id?: string | null;
  buyer_profile_id: string | null;
  digital_products: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    creator_id: string;
    external_submission_id: string | null;
    works: {
      id: string;
      title: string;
      is_public: boolean;
      content_class: "general" | "adult";
      source_project_id: string | null;
      external_submission_id: string | null;
      current_publication_id: string | null;
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
  let checkoutResult = await supabase
    .from("orders")
    .select(
      "id,buyer_email,buyer_profile_id,product_id,creator_id,amount,status,payment_mode,publication_id,digital_products:product_id(id,title,description,status,creator_id,external_submission_id,works:work_id(id,title,is_public,content_class,source_project_id,external_submission_id,current_publication_id))",
    )
    .eq("id", orderId)
    .eq("product_id", productId)
    .maybeSingle<CheckoutOrder>();
  if (checkoutResult.error && (
    checkoutResult.error.code === "42703" || checkoutResult.error.code === "PGRST204" ||
    checkoutResult.error.message.includes("publication_id")
  )) {
    checkoutResult = await supabase.from("orders").select(
      "id,buyer_email,buyer_profile_id,product_id,creator_id,amount,status,payment_mode,digital_products:product_id(id,title,description,status,creator_id,external_submission_id,works:work_id(id,title,is_public,content_class,source_project_id,external_submission_id,current_publication_id))",
    ).eq("id", orderId).eq("product_id", productId).maybeSingle<CheckoutOrder>();
  }
  const { data: checkoutOrder, error: checkoutOrderError } = checkoutResult;
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
  const externalSubmissionId = order.digital_products.external_submission_id
    ?? order.digital_products.works?.external_submission_id;
  if (externalSubmissionId) {
    const { data: externalListing, error: externalListingError } = await supabase
      .from("external_work_submissions")
      .select("id,status,owner_profile_id,work_id,product_id,publication_id,external_seller_profiles!owner_profile_id(status)")
      .eq("id", externalSubmissionId).maybeSingle<{
        id: string; status: string; owner_profile_id: string; work_id: string | null;
        product_id: string | null; publication_id: string | null;
        external_seller_profiles: { status: string } | null;
      }>();
    if (externalListingError || !externalListing || externalListing.status !== "published"
      || externalListing.owner_profile_id !== order.creator_id
      || externalListing.work_id !== order.digital_products.works?.id
      || externalListing.product_id !== order.product_id
      || externalListing.publication_id !== order.publication_id
      || externalListing.external_seller_profiles?.status !== "eligible"
      || order.digital_products.external_submission_id !== externalSubmissionId
      || order.digital_products.works?.external_submission_id !== externalSubmissionId) {
      throw new DomainError("VALIDATION_ERROR", "この商品は現在購入できません。");
    }
  }
  assertMarketplaceCanaryCheckoutTarget({
    buyerProfileId: order.buyer_profile_id,
    paymentMode: configuredPaymentMode,
    productId: order.product_id,
    sellerProfileId: order.creator_id,
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
    const session = await stripe.checkout.sessions.create(
      {
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
      },
      { idempotencyKey: `marketplace-checkout-${order.id}` },
    );
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
