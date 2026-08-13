export const cloudAiAdminPlanKeys = ["free", "trial", "creator"] as const;

export type CloudAiAdminPlanKey = (typeof cloudAiAdminPlanKeys)[number];

export function buildCloudAiAdminEntitlementPeriod(input: {
  planKey: CloudAiAdminPlanKey;
  durationDays: number;
  now: Date;
}) {
  const periodStartsAt = new Date(input.now);
  const periodEndsAt = new Date(input.now);
  periodEndsAt.setUTCDate(periodEndsAt.getUTCDate() + input.durationDays);
  return {
    plan_key: input.planKey,
    status: input.planKey === "trial" ? ("trialing" as const) : ("active" as const),
    source: "admin" as const,
    period_starts_at: periodStartsAt.toISOString(),
    period_ends_at: periodEndsAt.toISOString(),
    updated_at: periodStartsAt.toISOString(),
  };
}
