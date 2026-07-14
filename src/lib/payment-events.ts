import type Stripe from "stripe";

export type PaymentEventAction =
  | { type: "checkout-paid"; session: Stripe.Checkout.Session }
  | {
      type: "payment-status";
      paymentIntentId: string;
      status: "failed" | "refunded";
      orderId?: string;
    };

export function allowedOrderStatuses(status: "failed" | "refunded") {
  return status === "failed"
    ? ["pending", "failed"]
    : ["pending", "paid", "refunded"];
}

function paymentIntentId(
  value: string | Stripe.PaymentIntent | null,
): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}

export function planPaymentEvent(
  event: Stripe.Event,
): PaymentEventAction | null {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  )
    return { type: "checkout-paid", session: event.data.object };

  if (event.type === "checkout.session.async_payment_failed") {
    const id = paymentIntentId(event.data.object.payment_intent);
    return id
      ? {
          type: "payment-status",
          paymentIntentId: id,
          status: "failed",
          orderId: event.data.object.metadata?.order_id,
        }
      : null;
  }

  if (event.type === "payment_intent.payment_failed")
    return {
      type: "payment-status",
      paymentIntentId: event.data.object.id,
      status: "failed",
      orderId: event.data.object.metadata.order_id,
    };

  if (event.type === "charge.refunded" && event.data.object.refunded) {
    const id = paymentIntentId(event.data.object.payment_intent);
    return id
      ? {
          type: "payment-status",
          paymentIntentId: id,
          status: "refunded",
        }
      : null;
  }

  return null;
}
