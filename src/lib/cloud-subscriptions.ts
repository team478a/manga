import type { CloudSubscriptionAction } from "@/lib/subscription-events";
import { createStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveCheckoutOrigin } from "@/lib/checkout-policy";

export async function syncCloudAiSubscription(action: CloudSubscriptionAction) {
  const { data, error } = await createAdminClient().rpc(
    "apply_cloud_ai_subscription_event",
    {
      p_event_id: action.eventId,
      p_event_type: action.eventType,
      p_event_created_at: action.eventCreatedAt,
      p_profile_id: action.profileId,
      p_plan_key: action.planKey,
      p_status: action.status,
      p_period_starts_at: action.periodStartsAt,
      p_period_ends_at: action.periodEndsAt,
      p_stripe_customer_id: action.stripeCustomerId,
      p_stripe_subscription_id: action.stripeSubscriptionId,
    },
  );
  if (error) throw new Error("Cloud AIプランを同期できませんでした。");
  return data === true;
}

async function billingContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です。");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!profile) throw new Error("プロフィールが必要です。");
  const { data: entitlement } = await supabase
    .from("cloud_ai_entitlements")
    .select(
      "plan_key,status,source,period_ends_at,stripe_customer_id,stripe_subscription_id",
    )
    .eq("profile_id", profile.id)
    .single();
  if (!entitlement) throw new Error("Cloud AI利用枠が見つかりません。");
  return { user, profile, entitlement };
}

function siteOrigin(request: Request) {
  return resolveCheckoutOrigin({
    configured: process.env.NEXT_PUBLIC_SITE_URL,
    requestOrigin: new URL(request.url).origin,
    production: process.env.NODE_ENV === "production",
  });
}

export async function createCloudSubscriptionCheckout(request: Request) {
  const priceId = process.env.STRIPE_CLOUD_AI_CREATOR_PRICE_ID;
  if (!priceId) throw new Error("Cloud AI Stripe Priceが未設定です。");
  const { user, profile, entitlement } = await billingContext();
  if (
    entitlement.source === "stripe" &&
    (entitlement.status === "active" || entitlement.status === "trialing")
  )
    throw new Error("すでに有効なCloud AIプランがあります。");
  const trialDays = Number(process.env.STRIPE_CLOUD_AI_TRIAL_DAYS ?? 0);
  const session = await createStripeClient().checkout.sessions.create({
    mode: "subscription",
    customer: entitlement.stripe_customer_id ?? undefined,
    customer_email: entitlement.stripe_customer_id
      ? undefined
      : (user.email ?? undefined),
    client_reference_id: profile.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteOrigin(request)}/dashboard/billing?message=申込みを受け付けました`,
    cancel_url: `${siteOrigin(request)}/dashboard/billing?message=申込みをキャンセルしました`,
    metadata: {
      profile_id: profile.id,
      product_surface: "mangai-cloud-ai",
    },
    subscription_data: {
      metadata: {
        profile_id: profile.id,
        product_surface: "mangai-cloud-ai",
      },
      ...(Number.isInteger(trialDays) && trialDays >= 1 && trialDays <= 90
        ? { trial_period_days: trialDays }
        : {}),
    },
  });
  if (!session.url) throw new Error("Stripe Checkoutを開始できませんでした。");
  return session.url;
}

export async function createCloudBillingPortal(request: Request) {
  const { entitlement } = await billingContext();
  if (!entitlement.stripe_customer_id)
    throw new Error("Stripe請求情報がありません。");
  const session = await createStripeClient().billingPortal.sessions.create({
    customer: entitlement.stripe_customer_id,
    return_url: `${siteOrigin(request)}/dashboard/billing`,
  });
  return session.url;
}
