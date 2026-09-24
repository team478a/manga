const DAY_MS = 86_400_000;

export type CloudGeneralMonitorStoredStatus =
  | "active"
  | "paused"
  | "completed"
  | "revoked";

export type CloudGeneralMonitorOperationalState =
  | CloudGeneralMonitorStoredStatus
  | "scheduled"
  | "expiring_soon"
  | "expired"
  | "limit_reached";

export type CloudGeneralMonitorStatusSnapshot = {
  status: CloudGeneralMonitorStoredStatus;
  ai_request_limit: number;
  ai_requests_used: number;
  starts_at: string;
  expires_at: string;
};

export const cloudGeneralMonitorOperationalLabels: Record<
  CloudGeneralMonitorOperationalState,
  string
> = {
  active: "利用中",
  scheduled: "開始前",
  expiring_soon: "期限間近",
  expired: "期限切れ",
  limit_reached: "AI上限到達",
  paused: "一時停止",
  completed: "完了",
  revoked: "取消",
};

export function getCloudGeneralMonitorDaysRemaining(
  enrollment: CloudGeneralMonitorStatusSnapshot,
  now = Date.now(),
) {
  return Math.ceil((Date.parse(enrollment.expires_at) - now) / DAY_MS);
}

export function getCloudGeneralMonitorOperationalState(
  enrollment: CloudGeneralMonitorStatusSnapshot,
  now = Date.now(),
  expiryWarningDays = 7,
): CloudGeneralMonitorOperationalState {
  if (enrollment.status !== "active") return enrollment.status;
  if (Date.parse(enrollment.starts_at) > now) return "scheduled";
  if (Date.parse(enrollment.expires_at) <= now) return "expired";
  if (enrollment.ai_requests_used >= enrollment.ai_request_limit)
    return "limit_reached";
  if (getCloudGeneralMonitorDaysRemaining(enrollment, now) <= expiryWarningDays)
    return "expiring_soon";
  return "active";
}

export function getCloudGeneralMonitorAdminNotice(
  enrollment: CloudGeneralMonitorStatusSnapshot,
  now = Date.now(),
) {
  const state = getCloudGeneralMonitorOperationalState(enrollment, now);
  if (state === "expired")
    return {
      level: "error" as const,
      message:
        "保存状態はactiveですが、利用期限を過ぎているため現在は利用できません。",
    };
  if (state === "limit_reached")
    return {
      level: "error" as const,
      message: "モニターAI利用上限に達しています。",
    };
  if (state === "expiring_soon")
    return {
      level: "warning" as const,
      message: `利用期限まで残り${getCloudGeneralMonitorDaysRemaining(enrollment, now)}日です。`,
    };
  if (state === "scheduled")
    return {
      level: "info" as const,
      message: `利用開始日は${new Date(enrollment.starts_at).toLocaleDateString("ja-JP")}です。`,
    };
  return null;
}
