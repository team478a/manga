import { ProviderUnavailableError } from "./domain-errors.ts";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fingerprintPattern = /^[0-9a-f]{64}$/i;
const maximumWindowMs = 24 * 60 * 60 * 1000;

export type MarketplaceLiveCanaryEnvironment = {
  [key: string]: string | undefined;
  MANGAI_MARKETPLACE_LIVE_ACCESS?: string;
  MANGAI_MARKETPLACE_CANARY_PRODUCT_ID?: string;
  MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID?: string;
  MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID?: string;
  MANGAI_MARKETPLACE_CANARY_EXPIRES_AT?: string;
  MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT?: string;
};

export type MarketplaceLiveCanaryTarget = {
  productId: string;
  sellerProfileId: string;
  buyerProfileId: string;
  expiresAt: number;
  planFingerprint: string;
};

export type MarketplaceLiveCanaryAvailability = {
  enabled: boolean;
  reason: string | null;
  target: MarketplaceLiveCanaryTarget | null;
};

const unavailableMessage =
  "限定販売の対象を確認できないため、購入手続きを開始できません。";
const notEligibleMessage =
  "この商品は現在、指定された購入者だけが購入できます。";

export function inspectMarketplaceLiveCanary(
  environment: MarketplaceLiveCanaryEnvironment = process.env,
  now = Date.now(),
): MarketplaceLiveCanaryAvailability {
  const productId = environment.MANGAI_MARKETPLACE_CANARY_PRODUCT_ID?.trim();
  const sellerProfileId =
    environment.MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID?.trim();
  const buyerProfileId =
    environment.MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID?.trim();
  const fingerprint =
    environment.MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT?.trim();
  const expiresAtText =
    environment.MANGAI_MARKETPLACE_CANARY_EXPIRES_AT?.trim();
  const expiresAt = expiresAtText ? Date.parse(expiresAtText) : Number.NaN;
  const targetReady = Boolean(
    environment.MANGAI_MARKETPLACE_LIVE_ACCESS?.trim() === "canary" &&
      productId &&
      sellerProfileId &&
      buyerProfileId &&
      uuidPattern.test(productId) &&
      uuidPattern.test(sellerProfileId) &&
      uuidPattern.test(buyerProfileId) &&
      sellerProfileId.toLowerCase() !== buyerProfileId.toLowerCase() &&
      fingerprint &&
      fingerprintPattern.test(fingerprint) &&
      Number.isFinite(expiresAt) &&
      expiresAt > now &&
      expiresAt - now <= maximumWindowMs,
  );

  if (!targetReady) {
    return { enabled: false, reason: unavailableMessage, target: null };
  }

  return {
    enabled: true,
    reason: null,
    target: {
      productId: productId!,
      sellerProfileId: sellerProfileId!,
      buyerProfileId: buyerProfileId!,
      expiresAt,
      planFingerprint: fingerprint!,
    },
  };
}

export function isMarketplaceCanaryCheckoutTarget({
  buyerProfileId,
  environment = process.env,
  now = Date.now(),
  paymentMode,
  productId,
  sellerProfileId,
}: {
  buyerProfileId: string | null;
  environment?: MarketplaceLiveCanaryEnvironment;
  now?: number;
  paymentMode: "test" | "live";
  productId: string;
  sellerProfileId: string;
}) {
  if (
    !isMarketplaceCanaryCheckoutListing({
      environment,
      now,
      paymentMode,
      productId,
      sellerProfileId,
    })
  ) {
    return false;
  }
  if (paymentMode === "test") return true;
  const availability = inspectMarketplaceLiveCanary(environment, now);
  return Boolean(
    availability.target?.buyerProfileId === buyerProfileId,
  );
}

export function isMarketplaceCanaryCheckoutListing({
  environment = process.env,
  now = Date.now(),
  paymentMode,
  productId,
  sellerProfileId,
}: {
  environment?: MarketplaceLiveCanaryEnvironment;
  now?: number;
  paymentMode: "test" | "live";
  productId: string;
  sellerProfileId: string;
}) {
  if (paymentMode === "test") return true;
  const availability = inspectMarketplaceLiveCanary(environment, now);
  return Boolean(
    availability.enabled &&
      availability.target?.productId === productId &&
      availability.target.sellerProfileId === sellerProfileId,
  );
}

export function assertMarketplaceCanaryCheckoutTarget(
  input: Parameters<typeof isMarketplaceCanaryCheckoutTarget>[0],
) {
  if (!isMarketplaceCanaryCheckoutTarget(input)) {
    throw new ProviderUnavailableError(notEligibleMessage);
  }
}
