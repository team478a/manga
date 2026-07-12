import { NextResponse } from "next/server";
import Stripe from "stripe";
import { markCheckoutSessionPaid, markPaymentIntentStatus } from "@/lib/payments";
import { createStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ message: "Webhook設定が不足しています。" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = createStripeClient().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ message: "Webhook署名を確認できませんでした。" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await markCheckoutSessionPaid(event.data.object);
    } else if (event.type === "payment_intent.payment_failed") {
      await markPaymentIntentStatus(event.data.object.id, "failed", event.data.object.metadata.order_id);
    } else if (event.type === "charge.refunded") {
      const paymentIntent = event.data.object.payment_intent;
      const id = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
      if (id && event.data.object.refunded) await markPaymentIntentStatus(id, "refunded");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook処理に失敗しました。";
    return NextResponse.json({ message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
