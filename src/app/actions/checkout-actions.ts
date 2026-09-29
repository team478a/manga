"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { createStripeCheckoutSession } from "@/lib/checkout";
import { assertMarketplaceCanaryCheckoutTarget } from "@/lib/checkout-canary";
import { requireMarketplaceCheckoutMode } from "@/lib/checkout-mode";
import { normalizeBuyerEmail } from "@/lib/checkout-policy";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { requestOriginFromHeaders } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import { createOrReusePendingCheckoutOrder } from "@/modules/checkout/infrastructure/checkout-order-repository";
import { formText } from "./shared/form-data";

export async function createPendingOrder(formData: FormData) {
  const productId = formText(formData, "productId");
  let paymentMode: "test" | "live";
  try {
    paymentMode = requireMarketplaceCheckoutMode();
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "購入手続きを開始できません。",
    );
    redirect(`/checkout/${productId}?error=${encodeURIComponent(message)}`);
  }
  let buyerEmail = "";
  try {
    buyerEmail = normalizeBuyerEmail(formText(formData, "buyerEmail"));
  } catch {
    redirect(encodeURI(`/checkout/${productId}?error=メールアドレスを確認してください`));
  }
  if (!productId) {
    redirect(encodeURI(`/checkout/${productId}?error=メールアドレスを確認してください`));
  }
  if (!hasSupabaseAdminEnv()) {
    redirect(
      encodeURI(`/checkout/${productId}?error=Supabaseの管理用環境変数が設定されていません`),
    );
  }

  const supabase = await createClient();
  const {
    data: { user: buyerUser },
  } = await supabase.auth.getUser();
  let buyerProfileId: string | null = null;
  if (
    buyerUser?.email &&
    normalizeBuyerEmail(buyerUser.email) === buyerEmail
  ) {
    const { data: buyerProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", buyerUser.id)
      .maybeSingle<{ id: string }>();
    buyerProfileId = buyerProfile?.id ?? null;
  }
  const { data: product } = await supabase
    .from("digital_products")
    .select("id,creator_id,price,status,works:work_id(id,is_public,content_class,source_project_id,current_publication_id)")
    .eq("id", productId)
    .maybeSingle<{
      id: string;
      creator_id: string;
      price: number;
      status: string;
      works: {
        id: string;
        is_public: boolean;
        content_class: "general" | "adult";
        source_project_id: string | null;
        current_publication_id: string | null;
      } | null;
    }>();
  if (
    !product ||
    product.status !== "active" ||
    !product.works?.is_public ||
    product.works.content_class !== "general" ||
    (product.works.source_project_id &&
      !product.works.current_publication_id)
  ) {
    redirect(encodeURI(`/checkout/${productId}?error=この商品は現在購入できません`));
  }

  try {
    assertMarketplaceCanaryCheckoutTarget({
      buyerProfileId,
      paymentMode,
      productId: product.id,
      sellerProfileId: product.creator_id,
    });
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "この商品は現在購入できません。",
    );
    redirect(`/checkout/${productId}?error=${encodeURIComponent(message)}`);
  }

  const amount = Math.round(product.price);
  const platformFee = Math.floor(amount * 0.2);
  const creatorRevenue = amount - platformFee;
  const { data: order, error } = await createOrReusePendingCheckoutOrder({
    buyerEmail,
    buyerProfileId,
    productId: product.id,
    creatorId: product.creator_id,
    amount,
    platformFee,
    creatorRevenue,
    paymentMode,
  });
  if (error || !order) {
    redirect(encodeURI(`/checkout/${productId}?error=仮注文の作成に失敗しました`));
  }

  let checkoutUrl = "";
  try {
    const session = await createStripeCheckoutSession({
      orderId: order.id,
      productId: product.id,
      buyerEmail,
      origin: requestOriginFromHeaders(await headers()) ?? undefined,
      paymentMode,
    });
    checkoutUrl = session.url ?? "";
  } catch (error) {
    const message = safeDomainErrorMessage(
      error,
      "Stripe Checkoutへの遷移に失敗しました。",
    );
    redirect(
      `/checkout/${productId}?error=${encodeURIComponent(message)}&orderId=${order.id}`,
    );
  }
  redirect(checkoutUrl);
}
