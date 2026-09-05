import Link from "next/link";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { requireProfile } from "@/lib/auth";
import { getCloudGeneralMonitorEnrollment, getCloudGeneralMonitorNotice, isCloudGeneralMonitorActive } from "@/lib/cloud-general-monitor";
import { createClient } from "@/lib/supabase/server";
import { MonitorFeedbackForm } from "./MonitorFeedbackForm";
import { CloudDataNotice } from "@/components/CloudDataNotice";
import { safelyLoadCloudData } from "@/lib/cloud-runtime-resilience";
import { isMissingMonitorFeedbackSchema } from "@/modules/general-monitor/infrastructure/monitor-feedback-schema-compatibility";

type Feedback = {
  id: string;
  workflow_step: string;
  rating: number;
  outcome: string;
  comment: string;
  created_at: string;
  target_scope: "general" | "page" | "panel";
  page_number_snapshot: number | null;
  panel_name_snapshot: string | null;
  verdict: "accepted" | "needs_revision" | "unusable" | null;
  request_type: "feedback" | "bug" | "improvement" | "feature_request";
  title: string | null;
  severity: "none" | "minor" | "major" | "blocked" | null;
  public_status: "submitted" | "triaged" | "in_progress" | "resolved" | "closed";
  status_updated_at: string;
  attachment_path: string | null;
};

type LegacyFeedback = Pick<
  Feedback,
  "id" | "workflow_step" | "rating" | "outcome" | "comment" | "created_at"
>;

const requestTypeLabels = {
  feedback: "感想",
  bug: "不具合報告",
  improvement: "改善依頼",
  feature_request: "機能リクエスト",
} as const;

const qualityVerdictLabels = {
  accepted: "採用可",
  needs_revision: "要修正",
  unusable: "作り直し",
} as const;

const publicStatusLabels = {
  submitted: "受付済み",
  triaged: "確認済み",
  in_progress: "対応中",
  resolved: "修正済み",
  closed: "対応終了",
} as const;

export default async function GeneralMonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { profile } = await requireProfile();
  const { error, message } = await searchParams;
  const enrollment = await getCloudGeneralMonitorEnrollment(profile.id);
  const notice = getCloudGeneralMonitorNotice(enrollment);
  const feedbackLoad = await safelyLoadCloudData(
    "monitor/feedback-history",
    async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("cloud_general_monitor_feedback")
        .select("id,workflow_step,rating,outcome,comment,created_at,target_scope,page_number_snapshot,panel_name_snapshot,verdict,request_type,title,severity,public_status,status_updated_at,attachment_path")
        .eq("owner_profile_id", profile.id)
        .order("created_at", { ascending: false })
        .returns<Feedback[]>();
      if (!error) return data ?? [];
      if (!isMissingMonitorFeedbackSchema(error)) throw error;
      const { data: legacyData, error: legacyError } = await supabase
        .from("cloud_general_monitor_feedback")
        .select("id,workflow_step,rating,outcome,comment,created_at")
        .eq("owner_profile_id", profile.id)
        .order("created_at", { ascending: false })
        .returns<LegacyFeedback[]>();
      if (legacyError) throw legacyError;
      return (legacyData ?? []).map((item): Feedback => ({
        ...item,
        target_scope: "general",
        page_number_snapshot: null,
        panel_name_snapshot: null,
        verdict: null,
        request_type: "feedback",
        title: null,
        severity: null,
        public_status: "submitted",
        status_updated_at: item.created_at,
        attachment_path: null,
      }));
    },
    [],
  );
  const feedback = feedbackLoad.value;

  return (
    <main className="page max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold text-violet-700">先行販売購入者向け・招待制</p>
          <h1 className="mt-1 text-3xl font-bold">先行利用の状況とご意見</h1>
        </div>
        <Link className="button-secondary" href="/dashboard/monitor/guide">
          Webマニュアル
        </Link>
      </div>
      {!enrollment ? (
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">購入者向け先行利用の設定を確認できません</h2>
          <p className="mt-2 text-stone-600">
            招待メールの完了状況とは別に、管理画面のモニター利用枠が必要です。設定済みの場合は、時間をおいて再読み込みするか管理者へお問い合わせください。
          </p>
        </section>
      ) : (
        <>
          <section className="panel mt-6 border-violet-200 bg-violet-50">
            <h2 className="text-xl font-bold text-violet-950">先行販売でご購入いただいたお客様への先行提供です</h2>
            <p className="mt-2 leading-relaxed text-violet-950">
              この利用枠は、無料参加をお願いする一般的なモニター募集ではありません。正式リリース前の機能を段階的にご利用いただき、ご意見を伺う購入者向け先行利用です。先行利用中も購入者としての権利や、正式リリース後の利用資格は失われません。
            </p>
          </section>
          <section className="panel mt-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><p className="text-sm text-stone-500">状態</p><p className="font-bold">{enrollment.status}</p></div>
              <div><p className="text-sm text-stone-500">AI利用数</p><p className="font-bold">{enrollment.ai_requests_used} / {enrollment.ai_request_limit}</p></div>
              <div><p className="text-sm text-stone-500">期限</p><p className="font-bold">{new Date(enrollment.expires_at).toLocaleDateString("ja-JP")}</p></div>
            </div>
          </section>
          {notice ? <p className={`mt-5 rounded-lg p-4 ${notice.level === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-950"}`} role="status">{notice.message}</p> : null}
          {isCloudGeneralMonitorActive(enrollment) && !enrollment.onboarding_completed_at ? <Link className="button mt-5 bg-violet-700 hover:bg-violet-800" href="/dashboard/monitor/welcome">初回案内を確認</Link> : null}
          {isCloudGeneralMonitorActive(enrollment) ? (
            <section className="panel mt-6 border-violet-200 bg-violet-50">
              <h2 className="text-xl font-bold">漫画画像の品質確認</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-700">
                割り当てられた画像を1枚ずつ確認します。スマートフォンから途中保存して再開できます。
              </p>
              <Link className="button mt-4 w-full bg-violet-700 hover:bg-violet-800 sm:w-auto" href="/dashboard/monitor/quality-review">
                品質確認を開く
              </Link>
            </section>
          ) : null}
          {error ? <InlineErrorMessage radius="lg" role="alert">{error}</InlineErrorMessage> : null}
          {message ? <p className="mt-5 rounded-lg bg-green-50 p-4 text-green-800" role="status">{message}</p> : null}
          {enrollment.status === "active" ? <MonitorFeedbackForm /> : null}
          <section className="panel mt-6">
            <h2 className="text-xl font-bold">送信履歴</h2>
            {!feedbackLoad.ok ? <CloudDataNotice className="mt-4">送信履歴を一時的に確認できません。新しい報告はそのまま送信できます。</CloudDataNotice> : null}
            <div className="mt-4 space-y-3">
              {(feedback ?? []).map((item) => (
                <article className="rounded-xl border border-stone-200 p-4" key={item.id}>
                  <p className="text-sm font-bold">{requestTypeLabels[item.request_type]}・{item.workflow_step}・{item.rating}/5</p>
                  <p className="mt-1 text-xs font-bold text-violet-700">状況: {publicStatusLabels[item.public_status]}</p>
                  {item.title ? <h3 className="mt-1 font-bold">{item.title}</h3> : null}
                  {item.target_scope !== "general" ? (
                    <p className="mt-1 text-xs font-semibold text-violet-800">
                      {item.page_number_snapshot}ページ{item.panel_name_snapshot ? `・${item.panel_name_snapshot}` : "全体"}・{item.verdict ? qualityVerdictLabels[item.verdict] : "評価済み"}
                    </p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap break-words text-stone-700">{item.comment}</p>
                  {item.attachment_path ? <p className="mt-2 text-xs text-stone-500">スクリーンショット添付済み</p> : null}
                </article>
              ))}
              {!feedback?.length ? <p className="text-stone-600">まだ送信していません。</p> : null}
            </div>
          </section>
        </>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link className="button-secondary" href="/dashboard/monitor/guide">Webマニュアル</Link>
        <Link className="button-secondary" href="/dashboard">ダッシュボードへ戻る</Link>
      </div>
    </main>
  );
}
