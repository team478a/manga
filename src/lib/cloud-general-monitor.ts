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
  onboarding_completed_at: string | null;
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
      "profile_id,status,cohort,ai_request_limit,ai_requests_used,starts_at,expires_at,onboarding_completed_at,updated_at",
    )
    .eq("profile_id", profileId)
    .maybeSingle<CloudGeneralMonitorEnrollment>();
  if (error) return null;
  return data;
}

export function isCloudGeneralMonitorActive(
  enrollment: CloudGeneralMonitorEnrollment | null,
  now = Date.now(),
) {
  return Boolean(
    enrollment &&
      enrollment.status === "active" &&
      Date.parse(enrollment.starts_at) <= now &&
      Date.parse(enrollment.expires_at) > now,
  );
}

export function getCloudGeneralMonitorNotice(
  enrollment: CloudGeneralMonitorEnrollment | null,
  now = Date.now(),
) {
  if (!enrollment) return null;
  const remaining = Math.max(
    0,
    enrollment.ai_request_limit - enrollment.ai_requests_used,
  );
  const daysRemaining = Math.ceil((Date.parse(enrollment.expires_at) - now) / 86_400_000);
  if (enrollment.status !== "active")
    return { level: "error" as const, message: "モニター利用は現在停止中です。" };
  if (daysRemaining <= 0)
    return { level: "error" as const, message: "モニター利用期間が終了しました。" };
  if (remaining === 0)
    return { level: "error" as const, message: "AI利用上限に達しました。管理者へご連絡ください。" };
  if (remaining <= 5)
    return { level: "warning" as const, message: `AIを利用できる残り回数は${remaining}回です。` };
  if (daysRemaining <= 3)
    return { level: "warning" as const, message: `モニター利用期限まで残り${daysRemaining}日です。` };
  return null;
}

export function assertCloudGeneralMonitorActive(
  enrollment: CloudGeneralMonitorEnrollment | null,
) {
  if (!cloudGeneralMonitorBetaEnabled())
    throw new PermissionDeniedError("一般向け限定モニターは現在停止中です。");
  if (
    !isCloudGeneralMonitorActive(enrollment)
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
