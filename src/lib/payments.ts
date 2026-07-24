import Stripe from "stripe";
import { paidSessionReference } from "@/lib/checkout-policy";
import { DomainError } from "@/lib/domain-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowedOrderStatuses } from "@/lib/payment-events";

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
    .maybeSingle();
  if (paidOrderError)
    throw new DomainError(
      "INTERNAL_ERROR",
      "注文の支払い状態を確認できませんでした。",
      { cause: paidOrderError },
    );
  return Boolean(paidOrder);
}

export async function markPaymentIntentStatus(
  paymentIntentId: string,
  status: "failed" | "refunded",
  orderId?: string,
) {
  const supabase = createAdminClient();
  let query = supabase.from("orders").update({ status });
  query = query.in("status", allowedOrderStatuses(status));
  query = orderId
    ? query.eq("id", orderId)
    : query.eq("stripe_payment_intent_id", paymentIntentId);
  const { error } = await query;
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "注文の決済状態を更新できませんでした。",
      { cause: error },
    );
}
