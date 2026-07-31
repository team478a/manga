import { getCloudAdultGrokSettings } from "@/lib/cloud-adult-grok-settings";
import { getCloudGeneralMonitorEmailSettings } from "@/lib/cloud-general-monitor-email-settings";
import { createAdminClient } from "@/lib/supabase/admin";

const requiredFlags = [
  "CLOUD_RESEARCH_MVP_ENABLED",
  "CLOUD_PROPOSAL_GENERATION_ENABLED",
  "CLOUD_SCENARIO_GENERATION_ENABLED",
  "CLOUD_STORYBOARD_GENERATION_ENABLED",
  "CLOUD_STORYBOARD_CANVAS_ENABLED",
  "CLOUD_ADULT_RESEARCH_ENABLED",
  "CLOUD_ADULT_AI_PLANNING_ENABLED",
  "CLOUD_ADULT_SCENARIO_GENERATION_ENABLED",
  "CLOUD_ADULT_STORYBOARD_GENERATION_ENABLED",
  "CLOUD_ADULT_CANVAS_ENABLED",
  "CLOUD_ADULT_WORK_MANAGEMENT_ENABLED",
  "CLOUD_ADULT_MONITOR_BETA_ENABLED",
] as const;

export type AdultMonitorReadinessCheck = {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
  href?: string;
};

const enabled = (value: string | undefined) =>
  value?.trim().toLowerCase() === "true";

function validOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.pathname === "/" && !url.search && !url.hash
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export async function getCloudAdultMonitorReadiness(env: NodeJS.ProcessEnv = process.env) {
  const flagsReady = requiredFlags.every((key) => enabled(env[key]));
  const site = validOrigin(env.NEXT_PUBLIC_SITE_URL);
  const invite = validOrigin(env.MONITOR_INVITE_SITE_URL);
  let databaseReady = false;
  let active = 0;
  let openFeedback = 0;
  try {
    const admin = createAdminClient();
    const [enrollments, feedback, settings] = await Promise.all([
      admin.from("cloud_adult_monitor_enrollments").select("profile_id", { count: "exact", head: true }).eq("status", "active"),
      admin.from("cloud_adult_monitor_feedback").select("id", { count: "exact", head: true }).in("review_status", ["new", "reviewing"]),
      admin.from("cloud_adult_research_settings").select("enabled").eq("singleton", true).eq("enabled", true).maybeSingle(),
    ]);
    databaseReady = !enrollments.error && !feedback.error && !settings.error && Boolean(settings.data);
    active = enrollments.count ?? 0;
    openFeedback = feedback.count ?? 0;
  } catch {
    databaseReady = false;
  }
  let grokReady = false;
  let emailReady = false;
  try {
    const grok = await getCloudAdultGrokSettings();
    grokReady = Boolean(grok?.enabled && grok.configured);
  } catch {}
  try {
    const email = await getCloudGeneralMonitorEmailSettings();
    emailReady = Boolean(email?.enabled && email.configured && email.templateAvailable);
  } catch {}
  const checks: AdultMonitorReadinessCheck[] = [
    { key: "flags", label: "成人向け制作フロー", ready: flagsReady, detail: flagsReady ? "必要なFeature Flagは有効です。" : "対象環境の成人向け・共通Feature Flagを確認してください。" },
    { key: "database", label: "許可・同意・モニターDB", ready: databaseReady, detail: databaseReady ? "許可、同意、利用数、フィードバックを読み取れます。" : "成人向けmigrationとDB Kill Switchを確認してください。" },
    { key: "grok", label: "成人向けAI（Grok）", ready: grokReady, detail: grokReady ? "管理画面で保存したGrok接続を利用できます。" : "APIキーを保存して利用開始してください。", href: "/admin/adult-grok" },
    { key: "email", label: "招待メール", ready: emailReady, detail: emailReady ? "Resend送信設定と成人向け文面を利用できます。" : "Resend送信設定と成人向け文面を確認してください。", href: "/admin/adult-monitors/email" },
    { key: "origin", label: "招待先URL", ready: Boolean(site && invite && site === invite), detail: site && invite && site === invite ? "招待メールとアプリは同じ本番HTTPS originです。" : "NEXT_PUBLIC_SITE_URLとMONITOR_INVITE_SITE_URLを同じHTTPS originにしてください。" },
    { key: "image_boundary", label: "画像生成の境界", ready: !enabled(env.CLOUD_ADULT_PANEL_IMAGE_GENERATION_ENABLED), detail: "成人向け画像生成は今回の対象外として停止します。" },
  ];
  return { ready: checks.every((check) => check.ready), checks, stats: { active, openFeedback } };
}
