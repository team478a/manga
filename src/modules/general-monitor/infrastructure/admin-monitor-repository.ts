import type { CloudGeneralMonitorEnrollment } from "@/lib/cloud-general-monitor";
import { createAdminClient } from "@/lib/supabase/admin";

export type GeneralMonitorAdminProfile = {
  id: string;
  display_name: string;
};

export type GeneralMonitorAdminFeedback = {
  id: string;
  owner_profile_id: string;
  workflow_step: string;
  rating: number;
  outcome: string;
  comment: string;
  created_at: string;
  review_status: "new" | "reviewing" | "resolved";
  admin_note: string | null;
  target_scope: "general" | "page" | "panel";
  project_id: string | null;
  page_id: string | null;
  panel_id: string | null;
  page_number_snapshot: number | null;
  panel_name_snapshot: string | null;
  verdict: "accepted" | "needs_revision" | "unusable" | null;
  issue_type: string | null;
  severity: string | null;
  provider_id: string | null;
  model_id: string | null;
  generation_count: number;
  generation_cost_micros: number;
  generation_elapsed_ms: number;
  request_type: "feedback" | "bug" | "improvement" | "feature_request";
  title: string | null;
  page_url: string | null;
  environment: string | null;
  client_context: Record<string, unknown> | null;
  attachment_path: string | null;
  public_status: "submitted" | "triaged" | "in_progress" | "resolved" | "closed";
  status_updated_at: string;
};

export type GeneralMonitorEmailAudit = {
  id: string;
  action: string;
  from_email: string;
  created_at: string;
};

export async function loadGeneralMonitorAdminWorkspace() {
  const admin = createAdminClient();
  const [enrollmentsResult, feedbackResult, profilesResult] = await Promise.all([
    admin
      .from("cloud_general_monitor_enrollments")
      .select(
        "profile_id,status,cohort,ai_request_limit,ai_requests_used,starts_at,expires_at,onboarding_completed_at,updated_at",
      )
      .order("updated_at", { ascending: false })
      .returns<CloudGeneralMonitorEnrollment[]>(),
    admin
      .from("cloud_general_monitor_feedback")
      .select(
        "id,owner_profile_id,workflow_step,rating,outcome,comment,created_at,review_status,admin_note,target_scope,project_id,page_id,panel_id,page_number_snapshot,panel_name_snapshot,verdict,issue_type,severity,provider_id,model_id,generation_count,generation_cost_micros,generation_elapsed_ms,request_type,title,page_url,environment,client_context,attachment_path,public_status,status_updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<GeneralMonitorAdminFeedback[]>(),
    admin
      .from("profiles")
      .select("id,display_name")
      .returns<GeneralMonitorAdminProfile[]>(),
  ]);
  const attachmentPaths = [
    ...new Set(
      (feedbackResult.data ?? [])
        .filter((item) => item.target_scope === "general")
        .map((item) => item.attachment_path)
        .filter(Boolean),
    ),
  ] as string[];
  const attachmentUrls = new Map<string, string>();
  await Promise.allSettled(
    attachmentPaths.map(async (path) => {
      const { data } = await admin.storage
        .from("monitor-feedback")
        .createSignedUrl(path, 600);
      if (data?.signedUrl) attachmentUrls.set(path, data.signedUrl);
    }),
  );
  return { enrollmentsResult, feedbackResult, profilesResult, attachmentUrls };
}

export async function reviewGeneralMonitorFeedback(input: {
  actorProfileId: string;
  feedbackId: string;
  status: "new" | "reviewing" | "resolved";
  adminNote: string;
}) {
  return createAdminClient().rpc("review_cloud_general_monitor_feedback", {
    p_actor_profile_id: input.actorProfileId,
    p_feedback_id: input.feedbackId,
    p_status: input.status,
    p_admin_note: input.adminNote,
  });
}

export async function loadGeneralMonitorEmailAudits() {
  const { data } = await createAdminClient()
    .from("cloud_general_monitor_email_audit_logs")
    .select("id,action,from_email,created_at")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<GeneralMonitorEmailAudit[]>();
  return data;
}

export async function loadGeneralMonitorExportData() {
  const admin = createAdminClient();
  const [enrollments, profiles, feedback] = await Promise.all([
    admin.from("cloud_general_monitor_enrollments").select("*").order("created_at"),
    admin.from("profiles").select("id,display_name"),
    admin.from("cloud_general_monitor_feedback").select("owner_profile_id,rating"),
  ]);
  return { enrollments, profiles, feedback };
}

export async function generalMonitorInviteTrackingConfigured() {
  const { error } = await createAdminClient()
    .from("cloud_general_monitor_enrollments")
    .select("invite_email_sent_at,invite_email_send_count")
    .limit(1);
  return !error;
}

export async function activateGeneralMonitor(input: {
  actorProfileId: string;
  profileId: string;
  expiresAt: string;
  cohort: string;
  aiRequestLimit: number;
  adminNote: string;
}) {
  return createAdminClient().rpc("activate_cloud_general_monitor", {
    p_actor_profile_id: input.actorProfileId,
    p_target_profile_id: input.profileId,
    p_expires_at: input.expiresAt,
    p_cohort: input.cohort,
    p_ai_request_limit: input.aiRequestLimit,
    p_admin_note: input.adminNote,
  });
}

export async function loadGeneralMonitorInviteRecipient(profileId: string) {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("user_id,display_name")
    .eq("id", profileId)
    .maybeSingle<{ user_id: string; display_name: string }>();
  if (error || !profile) return null;
  const { data } = await admin.auth.admin.getUserById(profile.user_id);
  if (!data.user?.email) return null;
  return { email: data.user.email, name: profile.display_name || "" };
}

export async function loadActiveGeneralMonitorInvite(profileId: string) {
  const { data } = await createAdminClient()
    .from("cloud_general_monitor_enrollments")
    .select("status,expires_at,ai_request_limit")
    .eq("profile_id", profileId)
    .maybeSingle<{ status: string; expires_at: string; ai_request_limit: number }>();
  return data;
}

export async function recordGeneralMonitorInviteDelivery(
  actorProfileId: string,
  profileId: string,
) {
  const { error } = await createAdminClient().rpc(
    "record_cloud_general_monitor_invite_email_sent",
    {
      p_actor_profile_id: actorProfileId,
      p_target_profile_id: profileId,
    },
  );
  return !error;
}

export async function stopGeneralMonitor(input: {
  actorProfileId: string;
  profileId: string;
  status: "paused" | "completed" | "revoked";
  adminNote: string;
}) {
  return createAdminClient().rpc("stop_cloud_general_monitor", {
    p_actor_profile_id: input.actorProfileId,
    p_target_profile_id: input.profileId,
    p_status: input.status,
    p_admin_note: input.adminNote,
  });
}
