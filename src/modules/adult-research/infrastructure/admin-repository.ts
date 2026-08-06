import { createAdminClient } from "@/lib/supabase/admin";

export async function loadAdultResearchAdminOverview() {
  const admin = createAdminClient();
  return Promise.all([
    admin
      .from("cloud_adult_research_settings")
      .select("enabled,updated_at")
      .eq("singleton", true)
      .maybeSingle<{ enabled: boolean; updated_at: string }>(),
    admin
      .from("cloud_adult_research_entitlements")
      .select("profile_id", { count: "exact", head: true })
      .eq("status", "approved"),
  ]);
}

export function setAdultResearchEnabled(actorProfileId: string, enabled: boolean) {
  return createAdminClient().rpc("set_cloud_adult_research_enabled", {
    p_actor_profile_id: actorProfileId,
    p_enabled: enabled,
  });
}

