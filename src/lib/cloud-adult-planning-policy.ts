import { z } from "zod";
import { PermissionDeniedError, ValidationError } from "./domain-errors.ts";
import { featureFlagEnabled } from "./feature-flags.ts";

export const CLOUD_ADULT_PLANNING_FEATURE_KEY = "adult_planning";

export const cloudAdultPlanningFeatureEnabled = () =>
  featureFlagEnabled("CLOUD_ADULT_PLANNING_ENABLED");

export const cloudAdultPlanningInputSchema = z.object({
  status: z.enum(["draft", "ready"]),
  workingTitle: z.string().trim().min(1).max(200),
  concept: z.string().trim().min(1).max(2000),
  protagonist: z.string().trim().min(1).max(1000),
  protagonistGoal: z.string().trim().min(1).max(1000),
  centralConflict: z.string().trim().min(1).max(1000),
  readerPromise: z.string().trim().min(1).max(1000),
  tone: z.string().trim().min(1).max(500),
  differentiation: z.string().trim().min(1).max(1500),
  endingDirection: z.string().trim().min(1).max(1000),
  notes: z.string().trim().max(3000),
});

export type CloudAdultPlanningInput = z.infer<
  typeof cloudAdultPlanningInputSchema
>;

export type CloudAdultFeatureGrant = {
  profile_id: string;
  feature_key: typeof CLOUD_ADULT_PLANNING_FEATURE_KEY;
  status: "approved" | "suspended" | "expired";
  source: "purchase" | "legacy_purchase" | "admin_grant" | "campaign";
  granted_at: string;
  valid_until: string | null;
};

export type CloudAdultPlanningAccessReason =
  | "allowed"
  | "feature_disabled"
  | "adult_access_required"
  | "grant_missing"
  | "grant_inactive"
  | "grant_expired"
  | "configuration_unavailable";

export type CloudAdultPlanningAccess = {
  allowed: boolean;
  reason: CloudAdultPlanningAccessReason;
  grant: CloudAdultFeatureGrant | null;
};

export function evaluateCloudAdultPlanningAccess({
  featureEnabled,
  adultAccessAllowed,
  grant,
  now = new Date(),
}: {
  featureEnabled: boolean;
  adultAccessAllowed: boolean;
  grant: CloudAdultFeatureGrant | null;
  now?: Date;
}): CloudAdultPlanningAccess {
  if (!featureEnabled)
    return { allowed: false, reason: "feature_disabled", grant };
  if (!adultAccessAllowed)
    return { allowed: false, reason: "adult_access_required", grant };
  if (!grant) return { allowed: false, reason: "grant_missing", grant };
  if (grant.status !== "approved")
    return { allowed: false, reason: "grant_inactive", grant };
  if (grant.valid_until && new Date(grant.valid_until).getTime() <= now.getTime())
    return { allowed: false, reason: "grant_expired", grant };
  return { allowed: true, reason: "allowed", grant };
}

export function parseCloudAdultPlanningForm(formData: FormData) {
  const value = (name: string) => String(formData.get(name) ?? "");
  const parsed = cloudAdultPlanningInputSchema.safeParse({
    status: value("status"),
    workingTitle: value("workingTitle"),
    concept: value("concept"),
    protagonist: value("protagonist"),
    protagonistGoal: value("protagonistGoal"),
    centralConflict: value("centralConflict"),
    readerPromise: value("readerPromise"),
    tone: value("tone"),
    differentiation: value("differentiation"),
    endingDirection: value("endingDirection"),
    notes: value("notes"),
  });
  if (!parsed.success)
    throw new ValidationError(
      parsed.error.issues[0]?.message ??
        "成人向け企画ブリーフの入力を確認してください。",
    );
  return parsed.data;
}

export function assertCloudAdultPlanningAllowed(
  access: CloudAdultPlanningAccess,
) {
  if (access.allowed) return;
  throw new PermissionDeniedError(
    access.reason === "adult_access_required"
      ? "成人向け市場分析の利用許可と本人同意が必要です。"
      : "成人向け企画機能は許可されたアカウントだけが利用できます。",
  );
}
