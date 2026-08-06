import type { CloudResearchInput } from "./cloud-research.ts";
import { PermissionDeniedError } from "./domain-errors.ts";
import { featureFlagEnabled } from "./feature-flags.ts";

export const CLOUD_ADULT_RESEARCH_TERMS_VERSION = "adult-research-v1";

export const cloudAdultResearchFeatureEnabled = () =>
  featureFlagEnabled("CLOUD_ADULT_RESEARCH_ENABLED");

export type CloudAdultResearchEntitlement = {
  profile_id: string;
  status: "approved" | "suspended" | "expired";
  source: "purchase" | "legacy_purchase" | "admin_grant" | "campaign";
  granted_at: string;
  valid_until: string | null;
};

export type CloudAdultResearchConsent = {
  profile_id: string;
  age_confirmed_at: string;
  terms_version: typeof CLOUD_ADULT_RESEARCH_TERMS_VERSION;
  terms_accepted_at: string;
  withdrawn_at: string | null;
};

export type CloudAdultResearchAccessReason =
  | "allowed"
  | "feature_disabled"
  | "entitlement_missing"
  | "entitlement_inactive"
  | "entitlement_expired"
  | "consent_required"
  | "configuration_unavailable";

export type CloudAdultResearchAccess = {
  allowed: boolean;
  reason: CloudAdultResearchAccessReason;
  entitlement: CloudAdultResearchEntitlement | null;
  consent: CloudAdultResearchConsent | null;
};

export function evaluateCloudAdultResearchAccess({
  featureEnabled,
  entitlement,
  consent,
  now = new Date(),
}: {
  featureEnabled: boolean;
  entitlement: CloudAdultResearchEntitlement | null;
  consent: CloudAdultResearchConsent | null;
  now?: Date;
}): CloudAdultResearchAccess {
  if (!featureEnabled)
    return {
      allowed: false,
      reason: "feature_disabled",
      entitlement,
      consent,
    };
  if (!entitlement)
    return {
      allowed: false,
      reason: "entitlement_missing",
      entitlement,
      consent,
    };
  if (entitlement.status !== "approved")
    return {
      allowed: false,
      reason: "entitlement_inactive",
      entitlement,
      consent,
    };
  if (
    entitlement.valid_until &&
    new Date(entitlement.valid_until).getTime() <= now.getTime()
  )
    return {
      allowed: false,
      reason: "entitlement_expired",
      entitlement,
      consent,
    };
  if (
    !consent ||
    consent.terms_version !== CLOUD_ADULT_RESEARCH_TERMS_VERSION ||
    consent.withdrawn_at
  )
    return {
      allowed: false,
      reason: "consent_required",
      entitlement,
      consent,
    };
  return { allowed: true, reason: "allowed", entitlement, consent };
}

export function assertCloudResearchContentAllowed(
  input: Pick<CloudResearchInput, "contentClass">,
  access: CloudAdultResearchAccess,
) {
  if (input.contentClass === "general") return;
  if (!access.allowed)
    throw new PermissionDeniedError(
      access.reason === "consent_required"
        ? "成人向け市場分析を利用するには、18歳以上の確認と専用規約への同意が必要です。"
        : "成人向け市場分析は許可されたアカウントだけが利用できます。",
    );
}
