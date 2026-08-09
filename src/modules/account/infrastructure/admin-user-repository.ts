import type { CloudGeneralMonitorEnrollment } from "@/lib/cloud-general-monitor";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminUserRecord = {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  role: string;
  created_at: string;
};

export type AdminUserListRecord = Omit<AdminUserRecord, "bio">;

export type AdminUserInviteDelivery = {
  profile_id: string;
  invite_email_sent_at: string | null;
  invite_email_send_count: number;
};

export type AdultResearchEntitlement = {
  status: "approved" | "suspended" | "expired";
  source: "purchase" | "legacy_purchase" | "admin_grant" | "campaign";
  valid_until: string | null;
  admin_note: string | null;
};

export type AdultPlanningGrant = AdultResearchEntitlement;

export type AdminUserActionTarget = Pick<
  AdminUserRecord,
  "id" | "user_id" | "role"
>;

export async function loadAdminUserProfiles() {
  const supabase = await createClient();
  return supabase
    .from("profiles")
    .select("id,user_id,display_name,role,created_at")
    .order("created_at", { ascending: false })
    .returns<AdminUserListRecord[]>();
}

export function loadAdminUserDirectoryData() {
  const admin = createAdminClient();
  return Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("cloud_general_monitor_enrollments")
      .select("profile_id,invite_email_sent_at,invite_email_send_count")
      .returns<AdminUserInviteDelivery[]>(),
  ]);
}

export async function loadAdminUserProfile(profileId: string) {
  const supabase = await createClient();
  return supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle<AdminUserRecord>();
}

export async function loadAdminUserDetailData(input: {
  userId: string;
  profileId: string;
  includeGeneralMonitor: boolean;
}) {
  const admin = createAdminClient();
  const authResult = await admin.auth.admin.getUserById(input.userId);
  const entitlementResult = await admin
    .from("cloud_adult_research_entitlements")
    .select("status,source,valid_until,admin_note")
    .eq("profile_id", input.profileId)
    .maybeSingle<AdultResearchEntitlement>();
  const planningResult = await admin
    .from("cloud_adult_feature_grants")
    .select("status,source,valid_until,admin_note")
    .eq("profile_id", input.profileId)
    .eq("feature_key", "adult_planning")
    .maybeSingle<AdultPlanningGrant>();
  let generalMonitorResult = null;
  if (input.includeGeneralMonitor) {
    generalMonitorResult = await admin
      .from("cloud_general_monitor_enrollments")
      .select(
        "profile_id,status,cohort,ai_request_limit,ai_requests_used,starts_at,expires_at,onboarding_completed_at,updated_at",
      )
      .eq("profile_id", input.profileId)
      .maybeSingle<CloudGeneralMonitorEnrollment>();
  }
  return { authResult, entitlementResult, planningResult, generalMonitorResult };
}

export function loadAdminUserActionTarget(profileId: string) {
  return createAdminClient()
    .from("profiles")
    .select("id,user_id,role")
    .eq("id", profileId)
    .maybeSingle<AdminUserActionTarget>();
}

export function suspendAdminUser(userId: string) {
  return createAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });
}

export function restoreAdminUser(userId: string) {
  return createAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
}

export function softDeleteAdminUser(userId: string) {
  return createAdminClient().auth.admin.deleteUser(userId, true);
}
