import assert from "node:assert/strict";
import test from "node:test";
import { planCloudSubscriptionEvent } from "../src/lib/subscription-events.ts";

const profileId = "30000000-0000-4000-8000-000000000001";
const subscriptionEvent = (status = "active", overrides = {}) => ({
  id: "evt_subscription_1",
  type: "customer.subscription.updated",
  created: 1784361600,
  data: {
    object: {
      id: "sub_1",
      status,
      customer: "cus_1",
      metadata: {
        profile_id: profileId,
        product_surface: "mangai-cloud-ai",
      },
      items: {
        data: [
          {
            price: { id: "price_creator" },
            current_period_start: 1782864000,
            current_period_end: 1785542400,
          },
        ],
      },
      ...overrides,
    },
  },
});

test("Stripe subscription event maps trial and active entitlement periods", () => {
  assert.deepEqual(
    planCloudSubscriptionEvent(subscriptionEvent(), "price_creator"),
    {
      eventId: "evt_subscription_1",
      eventType: "customer.subscription.updated",
      eventCreatedAt: "2026-07-18T08:00:00.000Z",
      profileId,
      planKey: "creator",
      status: "active",
      periodStartsAt: "2026-07-01T00:00:00.000Z",
      periodEndsAt: "2026-08-01T00:00:00.000Z",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    },
  );
  const trial = planCloudSubscriptionEvent(
    subscriptionEvent("trialing"),
    "price_creator",
  );
  assert.equal(trial.planKey, "trial");
  assert.equal(trial.status, "trialing");
});

test("Stripe subscription event rejects mismatched price and profile metadata", () => {
  assert.throws(() =>
    planCloudSubscriptionEvent(subscriptionEvent(), "price_other"),
  );
  assert.throws(() =>
    planCloudSubscriptionEvent(
      subscriptionEvent("active", {
        metadata: {
          profile_id: "not-a-uuid",
          product_surface: "mangai-cloud-ai",
        },
      }),
      "price_creator",
    ),
  );
});
