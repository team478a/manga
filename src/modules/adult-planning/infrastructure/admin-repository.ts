import { CLOUD_ADULT_PLANNING_FEATURE_KEY } from "@/lib/cloud-adult-planning-policy";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setAdultPlanningGrant(input: {
  actorProfileId: string;
  targetProfileId: string;
  status: "approved" | "suspended" | "expired";
  source: "purchase" | "legacy_purchase" | "admin_grant" | "campaign";
  validUntil: string | null;
  adminNote: string;
}) {
  const admin = createAdminClient();
  const targetResult = await admin
    .from("profiles")
    .select("id")
    .eq("id", input.targetProfileId)
    .maybeSingle<{ id: string }>();
  if (!targetResult.data || targetResult.error)
    return { targetFound: false, error: targetResult.error };
  const result = await admin.rpc("set_cloud_adult_feature_grant", {
    p_actor_profile_id: input.actorProfileId,
    p_target_profile_id: input.targetProfileId,
    p_feature_key: CLOUD_ADULT_PLANNING_FEATURE_KEY,
    p_status: input.status,
    p_source: input.source,
    p_valid_until: input.validUntil,
    p_admin_note: input.adminNote,
  });
  return { targetFound: true, error: result.error };
}
