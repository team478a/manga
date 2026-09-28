const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fingerprintPattern = /^[0-9a-f]{64}$/i;
const maximumWindowMs = 24 * 60 * 60 * 1000;

export function assessMarketplaceRuntimeCanary(environment, now = Date.now()) {
  const productId = environment.MANGAI_MARKETPLACE_CANARY_PRODUCT_ID?.trim();
  const sellerProfileId =
    environment.MANGAI_MARKETPLACE_CANARY_SELLER_PROFILE_ID?.trim();
  const buyerProfileId =
    environment.MANGAI_MARKETPLACE_CANARY_BUYER_PROFILE_ID?.trim();
  const planFingerprint =
    environment.MANGAI_MARKETPLACE_CANARY_PLAN_FINGERPRINT?.trim();
  const expiresAtText =
    environment.MANGAI_MARKETPLACE_CANARY_EXPIRES_AT?.trim();
  const expiresAt = expiresAtText ? Date.parse(expiresAtText) : Number.NaN;
  const enabled = Boolean(
    environment.MANGAI_MARKETPLACE_LIVE_ACCESS?.trim() === "canary" &&
      productId &&
      sellerProfileId &&
      buyerProfileId &&
      uuidPattern.test(productId) &&
      uuidPattern.test(sellerProfileId) &&
      uuidPattern.test(buyerProfileId) &&
      sellerProfileId.toLowerCase() !== buyerProfileId.toLowerCase() &&
      planFingerprint &&
      fingerprintPattern.test(planFingerprint) &&
      Number.isFinite(expiresAt) &&
      expiresAt > now &&
      expiresAt - now <= maximumWindowMs,
  );

  return {
    enabled,
    target: enabled
      ? {
          buyerProfileId,
          expiresAt,
          planFingerprint,
          productId,
          sellerProfileId,
        }
      : null,
  };
}
