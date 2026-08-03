import { getCloudGeneralMonitorEmailSettings } from "@/lib/cloud-general-monitor-email-settings";
import { getCloudGeneralImageSettings } from "@/lib/cloud-general-image-settings";
import { getCloudResearchAiSettings } from "@/lib/cloud-research-ai-settings";
import { createAdminClient } from "@/lib/supabase/admin";

const requiredEnabledFlags = [
  "CLOUD_GENERAL_MONITOR_BETA_ENABLED",
  "CLOUD_RESEARCH_MVP_ENABLED",
  "CLOUD_PROPOSAL_GENERATION_ENABLED",
  "CLOUD_SCENARIO_GENERATION_ENABLED",
  "CLOUD_STORYBOARD_GENERATION_ENABLED",
  "CLOUD_STORYBOARD_CANVAS_ENABLED",
  "CLOUD_PANEL_IMAGE_GENERATION_ENABLED",
] as const;

const requiredDisabledFlags = [
  "CLOUD_ADULT_RESEARCH_ENABLED",
  "CLOUD_ADULT_PLANNING_ENABLED",
] as const;

export type GeneralMonitorReadinessCheck = {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
  href?: string;
  nextSteps?: string[];
};

export type GeneralMonitorReadiness = {
  ready: boolean;
  checks: GeneralMonitorReadinessCheck[];
  stats: {
    enrolled: number | null;
    active: number | null;
    onboarded: number | null;
    openFeedback: number | null;
  };
};

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function parseHttpsOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function getCloudGeneralMonitorReadiness(
  env: NodeJS.ProcessEnv = process.env,
): Promise<GeneralMonitorReadiness> {
  const workflowFlagsReady = requiredEnabledFlags.every((key) =>
    enabled(env[key])
  );
  const adultFlagsStopped = requiredDisabledFlags.every((key) =>
    !enabled(env[key])
  );
  const siteOrigin = parseHttpsOrigin(env.NEXT_PUBLIC_SITE_URL);
  const inviteOrigin = parseHttpsOrigin(env.MONITOR_INVITE_SITE_URL);
  const inviteOriginReady = Boolean(
    siteOrigin && inviteOrigin && siteOrigin === inviteOrigin,
  );

  let databaseReady = false;
  let enrolled: number | null = null;
  let active: number | null = null;
  let onboarded: number | null = null;
  let openFeedback: number | null = null;
  let emailReady = false;
  let researchAiReady = false;
  let imageAiReady = false;
  let imageAiSchemaReady = false;

  try {
    const admin = createAdminClient();
    const [enrollments, activeEnrollments, onboardedEnrollments, feedback] =
      await Promise.all([
        admin
          .from("cloud_general_monitor_enrollments")
          .select("profile_id", { count: "exact", head: true }),
        admin
          .from("cloud_general_monitor_enrollments")
          .select("profile_id", { count: "exact", head: true })
          .eq("status", "active"),
        admin
          .from("cloud_general_monitor_enrollments")
          .select("profile_id", { count: "exact", head: true })
          .not("onboarding_completed_at", "is", null),
        admin
          .from("cloud_general_monitor_feedback")
          .select("id", { count: "exact", head: true })
          .in("review_status", ["new", "reviewing"]),
      ]);
    databaseReady = [
      enrollments,
      activeEnrollments,
      onboardedEnrollments,
      feedback,
    ].every((result) => !result.error);
    if (databaseReady) {
      enrolled = enrollments.count ?? 0;
      active = activeEnrollments.count ?? 0;
      onboarded = onboardedEnrollments.count ?? 0;
      openFeedback = feedback.count ?? 0;
    }
  } catch {
    databaseReady = false;
  }

  try {
    const settings = await getCloudGeneralMonitorEmailSettings();
    emailReady = Boolean(settings?.enabled && settings.configured);
  } catch {
    emailReady = false;
  }

  try {
    const settings = await getCloudResearchAiSettings();
    researchAiReady = Boolean(settings?.enabled && settings.configured);
  } catch {
    researchAiReady = false;
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("cloud_general_image_provider_settings")
      .select("singleton", { count: "exact", head: true });
    imageAiSchemaReady = !error;
    const settings = await getCloudGeneralImageSettings();
    imageAiReady = Boolean(settings?.enabled && settings.configured);
  } catch {
    imageAiReady = false;
    imageAiSchemaReady = false;
  }

  const workerEnabled = enabled(env.MANGAI_CLOUD_AI_WORKER_ENABLED);
  const workerSecretReady = Boolean(
    env.MANGAI_CLOUD_AI_WORKER_SECRET &&
      env.MANGAI_CLOUD_AI_WORKER_SECRET.length >= 32,
  );
  const workerReady = workerEnabled && workerSecretReady;

  const checks: GeneralMonitorReadinessCheck[] = [
    {
      key: "workflow_flags",
      label: "一般向け制作フロー",
      ready: workflowFlagsReady,
      detail: workflowFlagsReady
        ? "モニターと一般向け制作工程のFeature Flagは有効です。"
        : "対象Previewブランチの一般向けFeature Flagを確認してください。",
    },
    {
      key: "adult_boundary",
      label: "成人向け機能の停止",
      ready: adultFlagsStopped,
      detail: adultFlagsStopped
        ? "今回対象外の成人向け機能は停止しています。"
        : "一般向けテスト公開では成人向けFeature Flagを停止してください。",
    },
    {
      key: "database",
      label: "モニター用データベース",
      ready: databaseReady,
      detail: databaseReady
        ? "招待・利用数・フィードバックを読み取れます。"
        : "3つのモニター用migrationと接続設定を確認してください。",
    },
    {
      key: "research_ai",
      label: "市場分析AI",
      ready: researchAiReady,
      detail: researchAiReady
        ? "管理画面で保存したAI接続を利用できます。"
        : "市場分析AIのAPIキーと利用状態を確認してください。",
      href: "/admin/research-ai",
    },
    {
      key: "image_ai",
      label: "一般向け画像生成AI",
      ready: imageAiReady,
      detail: imageAiReady
        ? "管理画面で保存した一般向け画像生成接続を利用できます。"
        : imageAiSchemaReady
          ? "BFL APIキー、モデル、利用状態のいずれかが未設定です。"
          : "画像生成Provider用のデータベース準備が未適用です。",
      href: "/admin/cloud-ai",
      nextSteps: imageAiReady
        ? undefined
        : imageAiSchemaReady
          ? [
              "設定画面でBFL APIキーと利用モデルを保存する。",
              "一般向け画像生成AIを「有効」にして保存する。",
            ]
          : [
              "Supabaseへ202607310004_cloud_general_image_provider.sqlを適用する。",
              "この画面を再読み込みし、BFL設定画面を開く。",
            ],
    },
    {
      key: "cloud_ai_worker",
      label: "画像生成Worker",
      ready: workerReady,
      detail: workerReady
        ? "画像生成Jobを処理するWorkerの実行条件が設定されています。"
        : "Vercel ProductionのWorker設定に不足があります。",
      href: "/admin/cloud-ai",
      nextSteps: workerReady
        ? undefined
        : [
            ...(workerEnabled
              ? []
              : ["MANGAI_CLOUD_AI_WORKER_ENABLED=trueを設定する。"]),
            ...(workerSecretReady
              ? []
              : [
                  "MANGAI_CLOUD_AI_WORKER_SECRETへ32文字以上のランダム値を設定する。",
                ]),
            "Productionを再デプロイし、Workerの定期呼び出しを確認する。",
          ],
    },
    {
      key: "email",
      label: "招待メール",
      ready: emailReady,
      detail: emailReady
        ? "Resend APIキーと送信元が保存されています。"
        : "Resend APIキーと認証済み送信元を保存してください。",
      href: "/admin/general-monitors/email",
    },
    {
      key: "invite_origin",
      label: "招待先URL",
      ready: inviteOriginReady,
      detail: inviteOriginReady
        ? "招待メールとアプリが同じ本番HTTPS originを使用します。"
        : "NEXT_PUBLIC_SITE_URLとMONITOR_INVITE_SITE_URLを同じ本番HTTPS originにしてください。",
    },
  ];

  return {
    ready: checks.every((check) => check.ready),
    checks,
    stats: { enrolled, active, onboarded, openFeedback },
  };
}
