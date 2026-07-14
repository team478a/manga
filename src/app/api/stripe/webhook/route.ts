import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  markCheckoutSessionPaid,
  markPaymentIntentStatus,
} from "@/lib/payments";
import { planPaymentEvent } from "@/lib/payment-events";
import { createStripeClient } from "@/lib/stripe";

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
    const action = planPaymentEvent(event);
    if (action?.type === "checkout-paid")
      await markCheckoutSessionPaid(action.session);
    else if (action?.type === "payment-status")
      await markPaymentIntentStatus(
        action.paymentIntentId,
        action.status,
        action.orderId,
      );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook処理に失敗しました。";
    return NextResponse.json({ message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
