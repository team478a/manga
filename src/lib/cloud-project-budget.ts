import { z } from "zod";

const optionalPositiveInteger = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? null : Number(value),
  z.number().int().positive().nullable(),
);

export const cloudProjectBudgetSchema = z.object({
  projectId: z.string().uuid(),
  monthlyCreditLimit: optionalPositiveInteger,
  monthlyCostLimitMicros: optionalPositiveInteger,
  storageLimitBytes: optionalPositiveInteger,
  warningPercent: z.coerce.number().int().min(50).max(100),
  generationEnabled: z.boolean(),
});

export type CloudProjectBudgetInput = z.infer<typeof cloudProjectBudgetSchema>;

export type CloudProjectResourceUsage = {
  monthly_credit_limit: number | null;
  monthly_cost_limit_micros: number | null;
  storage_limit_bytes: number | null;
  warning_percent: number;
  generation_enabled: boolean;
  credits_reserved: number;
  credits_used: number;
  cost_reserved_micros: number;
  cost_actual_micros: number;
  storage_bytes: number;
  job_count: number;
  active_job_count: number;
};

export function usagePercent(used: number, limit: number | null) {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function isProjectUsageWarning(used: number, limit: number | null, warningPercent: number) {
  return Boolean(limit && usagePercent(used, limit) >= warningPercent);
}
