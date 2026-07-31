import { createAdminClient } from "@/lib/supabase/admin";
import {
  PermissionDeniedError,
  QuotaExceededError,
} from "@/lib/domain-errors";

export const CLOUD_ADULT_MONITOR_OPERATIONS = [
  "research",
  "proposal",
  "scenario",
  "storyboard",
] as const;

export type CloudAdultMonitorOperation =
  (typeof CLOUD_ADULT_MONITOR_OPERATIONS)[number];

export type CloudAdultMonitorEnrollment = {
  profile_id: string;
  status: "active" | "paused" | "completed" | "revoked";
  cohort: string;
  ai_request_limit: number;
  ai_requests_used: number;
  starts_at: string;
  expires_at: string;
  onboarding_completed_at: string | null;
  updated_at: string;
};

export function cloudAdultMonitorBetaEnabled() {
  return process.env.CLOUD_ADULT_MONITOR_BETA_ENABLED?.toLowerCase() === "true";
}

export async function getCloudAdultMonitorEnrollment(profileId: string) {
  if (!cloudAdultMonitorBetaEnabled()) return null;
  const { data, error } = await createAdminClient()
    .from("cloud_adult_monitor_enrollments")
    .select(
      "profile_id,status,cohort,ai_request_limit,ai_requests_used,starts_at,expires_at,onboarding_completed_at,updated_at",
    )
    .eq("profile_id", profileId)
    .maybeSingle<CloudAdultMonitorEnrollment>();
  if (error) return null;
  return data;
}

export async function requireCloudAdultMonitor(profileId: string) {
  const enrollment = await getCloudAdultMonitorEnrollment(profileId);
  assertCloudAdultMonitorActive(enrollment);
  return enrollment!;
}

export function assertCloudAdultMonitorActive(
  enrollment: CloudAdultMonitorEnrollment | null,
) {
  if (!cloudAdultMonitorBetaEnabled())
    throw new PermissionDeniedError(
      "成人向け限定モニター機能は現在停止中です。",
    );
  if (
    !enrollment ||
    enrollment.status !== "active" ||
    Date.parse(enrollment.starts_at) > Date.now() ||
    Date.parse(enrollment.expires_at) <= Date.now()
  )
    throw new PermissionDeniedError(
      "成人向け機能は限定モニターとして利用許可されたアカウントだけが利用できます。",
    );
}

export function isCloudAdultMonitorActive(
  enrollment: CloudAdultMonitorEnrollment | null,
  now = Date.now(),
) {
  return Boolean(
    cloudAdultMonitorBetaEnabled() &&
    enrollment &&
    enrollment.status === "active" &&
    Date.parse(enrollment.starts_at) <= now &&
    Date.parse(enrollment.expires_at) > now,
  );
}

export async function consumeCloudAdultMonitorAiRequest(
  profileId: string,
  operation: CloudAdultMonitorOperation,
) {
  assertCloudAdultMonitorActive(
    await getCloudAdultMonitorEnrollment(profileId),
  );
  const { data, error } = await createAdminClient().rpc(
    "consume_cloud_adult_monitor_ai_request",
    {
      p_profile_id: profileId,
      p_operation: operation,
    },
  );
  if (error) {
    if (
      /limit|上限|quota/i.test(error.message) ||
      /monitor ai request/i.test(error.message)
    )
      throw new QuotaExceededError(
        "限定モニターのAI利用上限に達しました。管理者へご連絡ください。",
      );
    throw new PermissionDeniedError(
      "成人向け限定モニター機能を現在利用できません。",
    );
  }
  return Array.isArray(data) ? data[0] : data;
}
