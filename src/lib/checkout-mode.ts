import { ProviderUnavailableError } from "./domain-errors.ts";

export type MarketplaceCheckoutMode = "disabled" | "test" | "live";
export type OrderPaymentMode = Exclude<MarketplaceCheckoutMode, "disabled">;

export type MarketplaceCheckoutAvailability = {
  configuredMode: MarketplaceCheckoutMode;
  enabled: boolean;
  paymentMode: OrderPaymentMode | null;
  reason: string | null;
};

type CheckoutEnvironment = {
  [key: string]: string | undefined;
  MANGAI_MARKETPLACE_CHECKOUT_MODE?: string;
  STRIPE_SECRET_KEY?: string;
};

const invalidModeMessage =
  "販売モードの設定を確認できないため、購入手続きを開始できません。";

export function inspectMarketplaceCheckoutMode(
  environment: CheckoutEnvironment = process.env,
): MarketplaceCheckoutAvailability {
  const configured = environment.MANGAI_MARKETPLACE_CHECKOUT_MODE?.trim();
  const mode = (configured || "disabled") as MarketplaceCheckoutMode;

  if (!(["disabled", "test", "live"] as const).includes(mode)) {
    return {
      configuredMode: "disabled",
      enabled: false,
      paymentMode: null,
      reason: invalidModeMessage,
    };
  }
  if (mode === "disabled") {
    return {
      configuredMode: mode,
      enabled: false,
      paymentMode: null,
      reason: "MANGAI内の購入手続きは現在準備中です。",
    };
  }

  const secretKey = environment.STRIPE_SECRET_KEY?.trim() ?? "";
  const expectedPrefix = mode === "test" ? "sk_test_" : "sk_live_";
  if (
    !secretKey.startsWith(expectedPrefix) ||
    secretKey.length < 20 ||
    /(?:xxx|replace|placeholder|example)/i.test(secretKey)
  ) {
    return {
      configuredMode: mode,
      enabled: false,
      paymentMode: null,
      reason:
        mode === "test"
          ? "Stripeテスト環境の設定が一致しないため、テスト購入を開始できません。"
          : "Stripe本番環境の設定が一致しないため、購入手続きを開始できません。",
    };
  }

  return {
    configuredMode: mode,
    enabled: true,
    paymentMode: mode,
    reason: null,
  };
}

export function requireMarketplaceCheckoutMode(
  environment: CheckoutEnvironment = process.env,
): OrderPaymentMode {
  const availability = inspectMarketplaceCheckoutMode(environment);
  if (!availability.enabled || !availability.paymentMode) {
    throw new ProviderUnavailableError(
      availability.reason ?? invalidModeMessage,
    );
  }
  return availability.paymentMode;
}

export function paymentModeForStripeLivemode(
  livemode: boolean,
): OrderPaymentMode {
  return livemode ? "live" : "test";
}
