import type Stripe from "stripe";

export type CloudSubscriptionAction = {
  eventId: string;
  eventType: string;
  eventCreatedAt: string;
  profileId: string;
  planKey: "trial" | "creator";
  status: "active" | "trialing" | "past_due" | "canceled";
  periodStartsAt: string;
  periodEndsAt: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function subscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "trialing")
    return { planKey: "trial" as const, status: "trialing" as const };
  if (status === "active")
    return { planKey: "creator" as const, status: "active" as const };
  if (status === "canceled")
    return { planKey: "creator" as const, status: "canceled" as const };
  return { planKey: "creator" as const, status: "past_due" as const };
}

export function planCloudSubscriptionEvent(
  event: Stripe.Event,
  creatorPriceId: string | undefined,
): CloudSubscriptionAction | null {
  if (
    event.type !== "customer.subscription.created" &&
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  )
    return null;
  if (!creatorPriceId) throw new Error("Cloud AI Stripe Priceが未設定です。");
  const subscription = event.data.object;
  const profileId = subscription.metadata.profile_id;
  const item = subscription.items.data[0];
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  if (
    subscription.metadata.product_surface !== "mangai-cloud-ai" ||
    !profileId ||
    !UUID.test(profileId) ||
    !item ||
    item.price.id !== creatorPriceId ||
    !customerId ||
    item.current_period_end <= item.current_period_start
  )
    throw new Error("Cloud AI Subscription eventの対応関係が不正です。");
  const mapped = subscriptionStatus(subscription.status);
  return {
    eventId: event.id,
    eventType: event.type,
    eventCreatedAt: new Date(event.created * 1000).toISOString(),
    profileId,
    planKey: mapped.planKey,
    status: mapped.status,
    periodStartsAt: new Date(item.current_period_start * 1000).toISOString(),
    periodEndsAt: new Date(item.current_period_end * 1000).toISOString(),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
  };
}
