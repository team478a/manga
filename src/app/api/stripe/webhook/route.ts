import { NextResponse } from "next/server";
import Stripe from "stripe";
import { toMessageApiError } from "@/lib/api-errors";
import {
  ProviderUnavailableError,
  ValidationError,
} from "@/lib/domain-errors";
import {
  markCheckoutSessionPaid,
  markPaymentIntentStatus,
} from "@/lib/payments";
import { planPaymentEvent } from "@/lib/payment-events";
import { createStripeClient } from "@/lib/stripe";
import { planCloudSubscriptionEvent } from "@/lib/subscription-events";
import { syncCloudAiSubscription } from "@/lib/cloud-subscriptions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret)
      throw new ProviderUnavailableError(
        "Stripe Webhook設定が不足しています。",
      );
    if (!signature)
      throw new ValidationError("Webhook署名がありません。");

    const payload = await request.text();
    const stripe = createStripeClient();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      throw new ValidationError(
        "Webhook署名を確認できませんでした。",
      );
    }
    const subscriptionAction = planCloudSubscriptionEvent(
      event,
      process.env.STRIPE_CLOUD_AI_CREATOR_PRICE_ID,
    );
    if (subscriptionAction) await syncCloudAiSubscription(subscriptionAction);
    const paymentAction = planPaymentEvent(event);
    if (paymentAction?.type === "checkout-paid")
      await markCheckoutSessionPaid(paymentAction.session);
    else if (paymentAction?.type === "payment-status")
      await markPaymentIntentStatus(
        paymentAction.paymentIntentId,
        paymentAction.status,
        paymentAction.orderId,
      );
    return NextResponse.json({ received: true });
  } catch (error) {
    const response = toMessageApiError(
      error,
      "Webhook処理に失敗しました。",
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
