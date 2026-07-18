import { NextResponse } from "next/server";
import Stripe from "stripe";
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
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret)
    return NextResponse.json(
      { message: "Webhook設定が不足しています。" },
      { status: 400 },
    );

  let event: Stripe.Event;
  try {
    event = createStripeClient().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json(
      { message: "Webhook署名を確認できませんでした。" },
      { status: 400 },
    );
  }

  try {
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook処理に失敗しました。";
    return NextResponse.json({ message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
