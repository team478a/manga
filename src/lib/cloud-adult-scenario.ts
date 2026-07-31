import { z } from "zod";
import { getCloudAdultAiPlanningAccess } from "./cloud-adult-ai-planning.ts";
import { DomainError, PermissionDeniedError } from "./domain-errors.ts";
import { createClient } from "./supabase/server.ts";

export const CLOUD_ADULT_SCENARIO_FEATURE_KEY = "adult_scenario";
export const CLOUD_ADULT_SCENARIO_TERMS_VERSION = "adult-ai-scenario-v1";

export const cloudAdultScenarioFeatureEnabled = () =>
  process.env.CLOUD_ADULT_SCENARIO_GENERATION_ENABLED?.toLowerCase() === "true";

export type CloudAdultScenarioAccess = {
  allowed: boolean;
  reason:
    | "allowed"
    | "feature_disabled"
    | "adult_planning_required"
    | "grant_missing"
    | "grant_inactive"
    | "grant_expired"
    | "global_disabled"
    | "consent_required"
    | "configuration_unavailable";
};

export async function getCloudAdultScenarioAccess(
  profileId: string,
): Promise<CloudAdultScenarioAccess> {
  if (!cloudAdultScenarioFeatureEnabled())
    return { allowed: false, reason: "feature_disabled" };
  const planning = await getCloudAdultAiPlanningAccess(profileId);
  if (!planning.allowed)
    return { allowed: false, reason: "adult_planning_required" };
  const supabase = await createClient();
  const [settings, grant, consent] = await Promise.all([
    supabase.from("cloud_adult_scenario_settings").select("enabled")
      .eq("singleton", true).maybeSingle<{ enabled: boolean }>(),
    supabase.from("cloud_adult_feature_grants").select("status,valid_until")
      .eq("profile_id", profileId).eq("feature_key", CLOUD_ADULT_SCENARIO_FEATURE_KEY)
      .maybeSingle<{ status: string; valid_until: string | null }>(),
    supabase.from("cloud_adult_scenario_consents").select("terms_version,revoked_at")
      .eq("profile_id", profileId).eq("terms_version", CLOUD_ADULT_SCENARIO_TERMS_VERSION)
      .is("revoked_at", null).maybeSingle<{ terms_version: string; revoked_at: string | null }>(),
  ]);
  if (settings.error || grant.error || consent.error)
    return { allowed: false, reason: "configuration_unavailable" };
  if (!settings.data?.enabled) return { allowed: false, reason: "global_disabled" };
  if (!grant.data) return { allowed: false, reason: "grant_missing" };
  if (grant.data.status !== "approved") return { allowed: false, reason: "grant_inactive" };
  if (grant.data.valid_until && Date.parse(grant.data.valid_until) <= Date.now())
    return { allowed: false, reason: "grant_expired" };
  if (!consent.data) return { allowed: false, reason: "consent_required" };
  return { allowed: true, reason: "allowed" };
}

export function assertCloudAdultScenarioAllowed(access: CloudAdultScenarioAccess) {
  if (!access.allowed)
    throw new PermissionDeniedError(
      access.reason === "consent_required"
        ? "成人向けAIシナリオの利用条件と外部AI送信への同意が必要です。"
        : "成人向けAIシナリオは現在利用できません。",
    );
}

const consentSchema = z.object({
  confirmed18Plus: z.literal("true"),
  fictionalAdultsOnly: z.literal("true"),
  consensualOnly: z.literal("true"),
  noRealPerson: z.literal("true"),
  providerDisclosureAccepted: z.literal("true"),
});

export async function recordCloudAdultScenarioConsent(profileId: string, formData: FormData) {
  const parsed = consentSchema.safeParse({
    confirmed18Plus: formData.get("confirmed18Plus"),
    fictionalAdultsOnly: formData.get("fictionalAdultsOnly"),
    consensualOnly: formData.get("consensualOnly"),
    noRealPerson: formData.get("noRealPerson"),
    providerDisclosureAccepted: formData.get("providerDisclosureAccepted"),
  });
  if (!parsed.success) throw new PermissionDeniedError("すべての利用条件への確認が必要です。");
  const { error } = await (await createClient()).from("cloud_adult_scenario_consents").upsert({
    profile_id: profileId,
    confirmed_18_plus: true,
    fictional_adults_only: true,
    consensual_non_exploitative_only: true,
    no_real_person: true,
    provider_disclosure_accepted: true,
    terms_version: CLOUD_ADULT_SCENARIO_TERMS_VERSION,
    consented_at: new Date().toISOString(),
    revoked_at: null,
  }, { onConflict: "profile_id" });
  if (error) throw new DomainError("INTERNAL_ERROR", "成人向けAIシナリオの同意を保存できませんでした。", { cause: error });
}
