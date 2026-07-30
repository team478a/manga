import { createAdminClient } from "@/lib/supabase/admin";
import {
  PermissionDeniedError,
  QuotaExceededError,
} from "@/lib/domain-errors";

export const CLOUD_GENERAL_MONITOR_OPERATIONS = [
  "research",
  "proposal",
  "scenario",
  "storyboard",
  "panel_image",
] as const;

export type CloudGeneralMonitorOperation =
  (typeof CLOUD_GENERAL_MONITOR_OPERATIONS)[number];

export type CloudGeneralMonitorEnrollment = {
  profile_id: string;
  status: "active" | "paused" | "completed" | "revoked";
  cohort: string;
  ai_request_limit: number;
  ai_requests_used: number;
  starts_at: string;
  expires_at: string;
  updated_at: string;
};

export function cloudGeneralMonitorBetaEnabled() {
  return process.env.CLOUD_GENERAL_MONITOR_BETA_ENABLED?.toLowerCase() === "true";
}

export async function getCloudGeneralMonitorEnrollment(profileId: string) {
  if (!cloudGeneralMonitorBetaEnabled()) return null;
  const { data, error } = await createAdminClient()
    .from("cloud_general_monitor_enrollments")
    .select(
      "profile_id,status,cohort,ai_request_limit,ai_requests_used,starts_at,expires_at,updated_at",
    )
    .eq("profile_id", profileId)
    .maybeSingle<CloudGeneralMonitorEnrollment>();
  if (error) return null;
  return data;
}

export function assertCloudGeneralMonitorActive(
  enrollment: CloudGeneralMonitorEnrollment | null,
) {
  if (!cloudGeneralMonitorBetaEnabled())
    throw new PermissionDeniedError("一般向け限定モニターは現在停止中です。");
  if (
    !enrollment ||
    enrollment.status !== "active" ||
    Date.parse(enrollment.starts_at) > Date.now() ||
    Date.parse(enrollment.expires_at) <= Date.now()
  )
    throw new PermissionDeniedError(
      "この機能は招待された一般向けモニターだけが利用できます。",
    );
}

export async function requireCloudGeneralMonitor(profileId: string) {
  const enrollment = await getCloudGeneralMonitorEnrollment(profileId);
  assertCloudGeneralMonitorActive(enrollment);
  return enrollment!;
}

export async function consumeCloudGeneralMonitorAiRequest(
  profileId: string,
  operation: CloudGeneralMonitorOperation,
) {
  await requireCloudGeneralMonitor(profileId);
  const { data, error } = await createAdminClient().rpc(
    "consume_cloud_general_monitor_ai_request",
    { p_profile_id: profileId, p_operation: operation },
  );
  if (error) {
    if (/limit|quota|unavailable/i.test(error.message))
      throw new QuotaExceededError(
        "モニター期間中のAI利用上限に達しました。管理者へご連絡ください。",
      );
    throw new PermissionDeniedError(
      "一般向け限定モニターを現在利用できません。",
    );
  }
  return Array.isArray(data) ? data[0] : data;
}
