import Stripe from "stripe";

export function createStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripeのシークレットキーが設定されていません。");
  return new Stripe(key);
}

