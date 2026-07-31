import { createClient } from "@/lib/supabase/server";
import {
  cloudAdultResearchFeatureEnabled,
  evaluateCloudAdultResearchAccess,
  type CloudAdultResearchAccess,
  type CloudAdultResearchConsent,
  type CloudAdultResearchEntitlement,
} from "./cloud-adult-research-policy.ts";

export * from "./cloud-adult-research-policy.ts";

export async function getCloudAdultResearchAccess(
  profileId: string,
): Promise<CloudAdultResearchAccess> {
  if (!cloudAdultResearchFeatureEnabled())
    return evaluateCloudAdultResearchAccess({
      featureEnabled: false,
      entitlement: null,
      consent: null,
    });

  const supabase = await createClient();
  const [settingsResult, entitlementResult, consentResult] = await Promise.all([
    supabase
      .from("cloud_adult_research_settings")
      .select("enabled")
      .eq("singleton", true)
      .maybeSingle<{ enabled: boolean }>(),
    supabase
      .from("cloud_adult_research_entitlements")
      .select("profile_id,status,source,granted_at,valid_until")
      .eq("profile_id", profileId)
      .maybeSingle<CloudAdultResearchEntitlement>(),
    supabase
      .from("cloud_adult_research_consents")
      .select(
        "profile_id,age_confirmed_at,terms_version,terms_accepted_at,withdrawn_at",
      )
      .eq("profile_id", profileId)
      .maybeSingle<CloudAdultResearchConsent>(),
  ]);

  if (
    settingsResult.error ||
    entitlementResult.error ||
    consentResult.error
  )
    return {
      allowed: false,
      reason: "configuration_unavailable",
      entitlement: null,
      consent: null,
    };

  return evaluateCloudAdultResearchAccess({
    featureEnabled: settingsResult.data?.enabled === true,
    entitlement: entitlementResult.data,
    consent: consentResult.data,
  });
}
