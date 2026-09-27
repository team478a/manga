import type Stripe from "stripe";
import {
  paymentModeForStripeLivemode,
  type OrderPaymentMode,
} from "./checkout-mode.ts";

export type PaymentEventAction =
  | { type: "checkout-paid"; session: Stripe.Checkout.Session }
  | {
      type: "payment-status";
      paymentIntentId: string;
      status: "failed";
      orderId: string;
      productId: string;
      creatorId: string;
      paymentMode: OrderPaymentMode;
    }
  | {
      type: "payment-status";
      paymentIntentId: string;
      status: "refunded";
      paymentMode: OrderPaymentMode;
    };

export type PaymentStatusAction = Extract<
  PaymentEventAction,
  { type: "payment-status" }
>;

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

function failedPaymentReference(
  metadata: Stripe.Metadata | null | undefined,
  paymentMode: OrderPaymentMode,
) {
  const orderId = metadata?.order_id;
  const productId = metadata?.product_id;
  const creatorId = metadata?.creator_id;
  if (
    !orderId ||
    !productId ||
    !creatorId ||
    metadata?.payment_mode !== paymentMode
  )
    return null;
  return { orderId, productId, creatorId };
}

export function planPaymentEvent(
  event: Stripe.Event,
): PaymentEventAction | null {
  const paymentMode = paymentModeForStripeLivemode(Boolean(event.livemode));
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    if (event.data.object.mode === "subscription") return null;
    return { type: "checkout-paid", session: event.data.object };
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const id = paymentIntentId(event.data.object.payment_intent);
    const reference = failedPaymentReference(
      event.data.object.metadata,
      paymentMode,
    );
    return id && reference
      ? {
          type: "payment-status",
          paymentIntentId: id,
          status: "failed",
          ...reference,
          paymentMode,
        }
      : null;
  }

  if (event.type === "payment_intent.payment_failed") {
    const reference = failedPaymentReference(
      event.data.object.metadata,
      paymentMode,
    );
    return reference
      ? {
          type: "payment-status",
          paymentIntentId: event.data.object.id,
          status: "failed",
          ...reference,
          paymentMode,
        }
      : null;
  }

  if (event.type === "charge.refunded" && event.data.object.refunded) {
    const id = paymentIntentId(event.data.object.payment_intent);
    return id
      ? {
          type: "payment-status",
          paymentIntentId: id,
          status: "refunded",
          paymentMode,
        }
      : null;
  }

  return null;
}
