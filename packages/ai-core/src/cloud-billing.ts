import { z } from "zod";

export const cloudPlanKeySchema = z.enum(["free", "trial", "creator"]);
export type CloudPlanKey = z.infer<typeof cloudPlanKeySchema>;

export const cloudEntitlementStatusSchema = z.enum([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "expired",
]);
export type CloudEntitlementStatus = z.infer<
  typeof cloudEntitlementStatusSchema
>;

export const cloudQuotaSnapshotSchema = z.object({
  planKey: cloudPlanKeySchema,
  entitlementStatus: cloudEntitlementStatusSchema,
  periodStartsAt: z.string().datetime(),
  periodEndsAt: z.string().datetime(),
  creditsLimit: z.number().int().nonnegative(),
  creditsReserved: z.number().int().nonnegative(),
  creditsUsed: z.number().int().nonnegative(),
  costLimitMicros: z.number().int().nonnegative(),
  costReservedMicros: z.number().int().nonnegative(),
  costActualMicros: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
export type CloudQuotaSnapshot = z.infer<typeof cloudQuotaSnapshotSchema>;

export const cloudGenerationPriceSchema = z.object({
  providerId: z.string().trim().min(1).max(100),
  modelId: z.string().trim().min(1).max(200),
  jobType: z.string().trim().min(1).max(100),
  pricingVersion: z.string().trim().min(1).max(100),
  credits: z.number().int().positive().max(1000),
  maxCostMicros: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  active: z.boolean(),
});
export type CloudGenerationPrice = z.infer<typeof cloudGenerationPriceSchema>;

export type CloudQuotaDecision =
  | {
      allowed: true;
      creditsAfterReservation: number;
      costAfterReservationMicros: number;
    }
  | {
      allowed: false;
      reason:
        | "generation_disabled"
        | "entitlement_inactive"
        | "period_expired"
        | "price_unavailable"
        | "currency_mismatch"
        | "credit_quota_exceeded"
        | "cost_quota_exceeded";
    };

export function evaluateCloudGenerationQuota(input: {
  generationEnabled: boolean;
  now: Date;
  quota: CloudQuotaSnapshot;
  price: CloudGenerationPrice | null;
}): CloudQuotaDecision {
  const quota = cloudQuotaSnapshotSchema.parse(input.quota);
  const price = input.price
    ? cloudGenerationPriceSchema.parse(input.price)
    : null;
  if (!input.generationEnabled)
    return { allowed: false, reason: "generation_disabled" };
  if (
    quota.entitlementStatus !== "active" &&
    quota.entitlementStatus !== "trialing"
  )
    return { allowed: false, reason: "entitlement_inactive" };
  if (
    input.now < new Date(quota.periodStartsAt) ||
    input.now >= new Date(quota.periodEndsAt)
  )
    return { allowed: false, reason: "period_expired" };
  if (!price?.active) return { allowed: false, reason: "price_unavailable" };
  if (price.currency !== quota.currency)
    return { allowed: false, reason: "currency_mismatch" };
  const creditsAfterReservation =
    quota.creditsReserved + quota.creditsUsed + price.credits;
  if (creditsAfterReservation > quota.creditsLimit)
    return { allowed: false, reason: "credit_quota_exceeded" };
  const costAfterReservationMicros =
    quota.costReservedMicros + quota.costActualMicros + price.maxCostMicros;
  if (costAfterReservationMicros > quota.costLimitMicros)
    return { allowed: false, reason: "cost_quota_exceeded" };
  return {
    allowed: true,
    creditsAfterReservation,
    costAfterReservationMicros,
  };
}
