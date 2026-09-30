import {
  inspectMarketplaceCheckoutMode,
  type MarketplaceCheckoutMode,
} from "../../../lib/checkout-mode.ts";
import {
  inspectMarketplaceLiveCanary,
  type MarketplaceLiveCanaryEnvironment,
} from "../../../lib/checkout-canary.ts";

export type MarketplaceCheckoutOperationalReadiness = {
  ready: boolean;
  mode: MarketplaceCheckoutMode;
  modeLabel: string;
  reason: string | null;
  canary: {
    ready: boolean;
    expiresAt: string | null;
    remainingMinutes: number | null;
  } | null;
};

const modeLabels: Record<MarketplaceCheckoutMode, string> = {
  disabled: "停止中",
  test: "隔離テスト",
  live: "限定本番",
};

export function assessMarketplaceCheckoutOperationalReadiness(
  environment: MarketplaceLiveCanaryEnvironment = process.env,
  now = Date.now(),
): MarketplaceCheckoutOperationalReadiness {
  const checkout = inspectMarketplaceCheckoutMode(environment, now);
  const canary =
    checkout.configuredMode === "live"
      ? inspectMarketplaceLiveCanary(environment, now)
      : null;
  const expiresAt = canary?.target?.expiresAt ?? null;

  return {
    ready: checkout.enabled,
    mode: checkout.configuredMode,
    modeLabel: modeLabels[checkout.configuredMode],
    reason: checkout.reason,
    canary: canary
      ? {
          ready: canary.enabled,
          expiresAt:
            expiresAt === null ? null : new Date(expiresAt).toISOString(),
          remainingMinutes:
            expiresAt === null
              ? null
              : Math.max(0, Math.ceil((expiresAt - now) / (60 * 1000))),
        }
      : null,
  };
}
