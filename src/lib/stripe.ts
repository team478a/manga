import Stripe from "stripe";
import { ProviderUnavailableError } from "./domain-errors.ts";

export function createStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key)
    throw new ProviderUnavailableError(
      "Stripeのシークレットキーが設定されていません。",
    );
  return new Stripe(key);
}
