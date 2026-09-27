import Stripe from "stripe";
import { paidSessionReference } from "@/lib/checkout-policy";
import { DomainError } from "@/lib/domain-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  allowedOrderStatuses,
  type PaymentStatusAction,
} from "@/lib/payment-events";

export async function markCheckoutSessionPaid(
  session: Stripe.Checkout.Session,
) {
  const reference = paidSessionReference(session);
  if (!reference) return false;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntentId,
      paid_at: new Date().toISOString(),
    })
    .eq("id", reference.orderId)
    .eq("product_id", reference.productId)
    .eq("status", "pending")
    .eq("payment_mode", reference.paymentMode)
    .select("id")
    .maybeSingle();

  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "注文の支払い状態を更新できませんでした。",
      { cause: error },
    );
  if (data) return true;

  const { data: paidOrder, error: paidOrderError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", reference.orderId)
    .eq("product_id", reference.productId)
    .eq("status", "paid")
    .eq("payment_mode", reference.paymentMode)
    .maybeSingle();
  if (paidOrderError)
    throw new DomainError(
      "INTERNAL_ERROR",
      "注文の支払い状態を確認できませんでした。",
      { cause: paidOrderError },
    );
  return Boolean(paidOrder);
}

export async function markPaymentIntentStatus(action: PaymentStatusAction) {
  const supabase = createAdminClient();
  let query = supabase.from("orders").update({ status: action.status });
  query = query.in("status", allowedOrderStatuses(action.status));
  query =
    action.status === "failed"
      ? query
          .eq("id", action.orderId)
          .eq("product_id", action.productId)
          .eq("creator_id", action.creatorId)
      : query.eq("stripe_payment_intent_id", action.paymentIntentId);
  query = query.eq("payment_mode", action.paymentMode);
  const { error } = await query;
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "注文の決済状態を更新できませんでした。",
      { cause: error },
    );
}
