import { z } from "zod";

export const DEZGO_PRICING_VERSION = "sd1-2026-07-17";
export const DEZGO_PRICING_VALID_UNTIL = "2026-08-17T00:00:00.000Z";
const SAFETY_MULTIPLIER = 1.25;

const estimateInputSchema = z.object({
  width: z.number().int().min(320).max(1024),
  height: z.number().int().min(320).max(1024),
  steps: z.number().int().min(10).max(150),
});

export type DezgoCostBlockReason =
  | "pricing_stale"
  | "cost_limit_not_set"
  | "cost_limit_exceeded"
  | "balance_unavailable"
  | "balance_insufficient";

export function estimateDezgoTextToImageCost(input: {
  width: number;
  height: number;
  steps: number;
}) {
  const value = estimateInputSchema.parse(input);
  const longestSide = Math.max(value.width, value.height);
  const publishedThirtyStepMicroUsd =
    longestSide <= 512 ? 1_900 : longestSide <= 768 ? 8_700 : 18_100;
  const publishedBracketEstimateUsd =
    Math.ceil((publishedThirtyStepMicroUsd * value.steps) / 30) / 1_000_000;
  const authorizationCostUsd =
    Math.ceil(publishedBracketEstimateUsd * SAFETY_MULTIPLIER * 1_000_000) /
    1_000_000;
  return {
    publishedBracketEstimateUsd,
    authorizationCostUsd,
    currency: "USD" as const,
    pricingVersion: DEZGO_PRICING_VERSION,
    pricingValidUntil: DEZGO_PRICING_VALID_UNTIL,
    safetyMultiplier: SAFETY_MULTIPLIER,
  };
}

export function evaluateDezgoCostGuard(input: {
  width: number;
  height: number;
  steps: number;
  monthlyLimitUsd: number | null;
  monthlyActualUsd: number;
  monthlyReservedUsd: number;
  balanceUsd: number | null;
  now?: Date;
}) {
  const estimate = estimateDezgoTextToImageCost(input);
  const now = input.now ?? new Date();
  let blockReason: DezgoCostBlockReason | null = null;
  if (now.getTime() > Date.parse(DEZGO_PRICING_VALID_UNTIL))
    blockReason = "pricing_stale";
  else if (input.monthlyLimitUsd === null)
    blockReason = "cost_limit_not_set";
  else if (
    input.monthlyActualUsd +
      input.monthlyReservedUsd +
      estimate.authorizationCostUsd >
    input.monthlyLimitUsd + 1e-9
  )
    blockReason = "cost_limit_exceeded";
  else if (input.balanceUsd === null) blockReason = "balance_unavailable";
  else if (input.balanceUsd + 1e-9 < estimate.authorizationCostUsd)
    blockReason = "balance_insufficient";
  return {
    ...estimate,
    allowed: blockReason === null,
    blockReason,
    monthlyActualUsd: input.monthlyActualUsd,
    monthlyReservedUsd: input.monthlyReservedUsd,
    monthlyRemainingUsd:
      input.monthlyLimitUsd === null
        ? null
        : Math.max(
            0,
            input.monthlyLimitUsd -
              input.monthlyActualUsd -
              input.monthlyReservedUsd,
          ),
    balanceUsd: input.balanceUsd,
  };
}

export function dezgoPreviewDimensions(width: number, height: number) {
  const normalize = (value: number) =>
    Math.max(320, Math.min(1024, Math.floor(value / 8) * 8));
  return { width: normalize(width), height: normalize(height) };
}
