"use server";

import { redirect } from "next/navigation";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { createStripeCheckoutSession } from "@/lib/checkout";
import { normalizeBuyerEmail } from "@/lib/checkout-policy";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formText } from "./shared/form-data";

export async function createPendingOrder(formData: FormData) {
  const productId = formText(formData, "productId");
  let buyerEmail = "";
  try {
    buyerEmail = normalizeBuyerEmail(formText(formData, "buyerEmail"));
  } catch {
    redirect(`/checkout/${productId}?error=メールアドレスを確認してください`);
  }
  if (!productId) {
    redirect(`/checkout/${productId}?error=メールアドレスを確認してください`);
  }
  if (!hasSupabaseAdminEnv()) {
    redirect(
      `/checkout/${productId}?error=Supabaseの管理用環境変数が設定されていません`,
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
    .select("id,creator_id,price,status,works:work_id(id,is_public)")
    .eq("id", productId)
    .maybeSingle<{
      id: string;
      creator_id: string;
      price: number;
      status: string;
      works: { id: string; is_public: boolean } | null;
    }>();
  if (!product || product.status !== "active" || !product.works?.is_public) {
    redirect(`/checkout/${productId}?error=この商品は現在購入できません`);
  }

  const amount = Math.round(product.price);
  const platformFee = Math.floor(amount * 0.2);
  const creatorRevenue = amount - platformFee;
  const adminSupabase = createAdminClient();
  const { data: order, error } = await adminSupabase
    .from("orders")
    .insert({
      buyer_email: buyerEmail,
      buyer_profile_id: buyerProfileId,
      product_id: product.id,
      creator_id: product.creator_id,
      amount,
      platform_fee: platformFee,
      creator_revenue: creatorRevenue,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !order) {
    redirect(`/checkout/${productId}?error=仮注文の作成に失敗しました`);
  }

  let checkoutUrl = "";
  try {
    const session = await createStripeCheckoutSession({
      orderId: order.id,
      productId: product.id,
      buyerEmail,
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
