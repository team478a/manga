import Link from "next/link";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cloudGeneralMonitorBetaEnabled,
  type CloudGeneralMonitorEnrollment,
} from "@/lib/cloud-general-monitor";
import { reviewGeneralMonitorFeedbackAction } from "./actions";

type Profile = { id: string; display_name: string };
type Feedback = {
  id: string; owner_profile_id: string; workflow_step: string;
  rating: number; outcome: string; comment: string; created_at: string;
  review_status: "new" | "reviewing" | "resolved"; admin_note: string | null;
  target_scope: "general" | "page" | "panel";
  project_id: string | null; page_id: string | null; panel_id: string | null;
  page_number_snapshot: number | null; panel_name_snapshot: string | null;
  verdict: "accepted" | "needs_revision" | "unusable" | null;
  issue_type: string | null; severity: string | null;
  provider_id: string | null; model_id: string | null;
  generation_count: number; generation_cost_micros: number; generation_elapsed_ms: number;
  request_type: "feedback" | "bug" | "improvement" | "feature_request";
  title: string | null; page_url: string | null; environment: string | null;
};

const verdictLabels = {
  accepted: "採用可",
  needs_revision: "要修正",
  unusable: "作り直し",
} as const;

const issueLabels: Record<string, string> = {
  none: "問題なし", face: "顔・表情", hands: "手・指", composition: "構図・ポーズ",
  consistency: "一貫性", text: "文字・吹き出し", image_quality: "画質・崩れ",
  missing_content: "不足・欠落", operation: "操作", other: "その他",
};

const severityLabels: Record<string, string> = {
  none: "影響なし", minor: "軽微", major: "大きい", blocked: "進行不能",
};

export default async function GeneralMonitorsAdminPage() {
  await requireAdmin();
  if (!cloudGeneralMonitorBetaEnabled()) {
    return (
      <main className="page">
        <p className="font-semibold text-violet-700">一般向け・無料限定公開</p>
        <h1 className="mt-1 text-3xl font-bold">モニター管理</h1>
        <p className="mt-6 rounded-lg bg-stone-100 p-4 text-stone-700" role="status">
          Feature Flagが停止中です。migration適用後に対象Previewブランチだけで有効化してください。
        </p>
        <Link
          className="button-secondary mt-4"
          href="/admin/general-monitors/guide"
        >
          スタッフマニュアル
        </Link>
        <Link
          className="button-secondary ml-2 mt-4"
          href="/admin/general-monitors/readiness"
        >
          テスト公開チェック
        </Link>
        <Link
          className="button-secondary ml-2 mt-4"
          href="/admin/general-monitors/email"
        >
          招待メール設定
        </Link>
      </main>
    );
  }
  const admin = createAdminClient();
  const [enrollmentsResult, feedbackResult, profilesResult] = await Promise.all([
    admin.from("cloud_general_monitor_enrollments")
      .select("profile_id,status,cohort,ai_request_limit,ai_requests_used,starts_at,expires_at,onboarding_completed_at,updated_at")
      .order("updated_at", { ascending: false })
      .returns<CloudGeneralMonitorEnrollment[]>(),
    admin.from("cloud_general_monitor_feedback")
      .select("id,owner_profile_id,workflow_step,rating,outcome,comment,created_at,review_status,admin_note,target_scope,project_id,page_id,panel_id,page_number_snapshot,panel_name_snapshot,verdict,issue_type,severity,provider_id,model_id,generation_count,generation_cost_micros,generation_elapsed_ms,request_type,title,page_url,environment")
      .order("created_at", { ascending: false }).limit(100).returns<Feedback[]>(),
    admin.from("profiles").select("id,display_name").returns<Profile[]>(),
  ]);
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const qualityFeedback = (feedbackResult.data ?? []).filter((item) => item.target_scope !== "general");
  const acceptedCount = qualityFeedback.filter((item) => item.verdict === "accepted").length;
  const revisionCount = qualityFeedback.filter((item) => item.verdict === "needs_revision").length;
  const unusableCount = qualityFeedback.filter((item) => item.verdict === "unusable").length;
  const totalGenerationCount = qualityFeedback.reduce((sum, item) => sum + item.generation_count, 0);
  const totalGenerationCostMicros = qualityFeedback.reduce((sum, item) => sum + item.generation_cost_micros, 0);

  return (
    <main className="page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold text-violet-700">一般向け・無料限定公開</p>
          <h1 className="mt-1 text-3xl font-bold">モニター管理</h1>
          <p className="mt-2 text-stone-600">招待、期限、AI利用数、感想を確認します。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="button bg-violet-700 hover:bg-violet-800" href="/admin/general-monitors/readiness">テスト公開チェック</Link>
          <Link className="button-secondary" href="/admin/general-monitors/guide">スタッフマニュアル</Link>
          <Link className="button-secondary" href="/admin/general-monitors/email">招待メール設定</Link>
          <Link className="button-secondary" href="/admin/general-monitors/export">CSV出力</Link>
          <Link className="button-secondary" href="/admin/monitor-issues">報告・自動修正キュー</Link>
          <Link className="button-secondary" href="/admin/users">ユーザーを招待</Link>
        </div>
      </div>
      {enrollmentsResult.error ? (
        <p className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-950" role="alert">
          モニター情報を読み込めません。migrationを確認してください。
        </p>
      ) : (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {(enrollmentsResult.data ?? []).map((monitor) => (
            <article className="panel min-w-0" key={monitor.profile_id}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm text-stone-500">{monitor.cohort}</p>
                  <h2 className="mt-1 break-words text-xl font-bold">{profiles.get(monitor.profile_id)?.display_name || "表示名未設定"}</h2>
                </div>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">{monitor.status}</span>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-stone-500">AI利用数</dt><dd className="font-bold">{monitor.ai_requests_used} / {monitor.ai_request_limit}</dd></div>
                <div><dt className="text-stone-500">期限</dt><dd className="font-bold">{new Date(monitor.expires_at).toLocaleString("ja-JP")}</dd></div>
              </dl>
              <Link className="button-secondary mt-5 w-full" href={`/admin/users/${monitor.profile_id}`}>設定・停止</Link>
            </article>
          ))}
          {!enrollmentsResult.data?.length ? <p className="panel text-stone-600">モニターはまだ登録されていません。</p> : null}
        </section>
      )}
      <section className="panel mt-7">
        <h2 className="text-xl font-bold">モニターの声</h2>
        {qualityFeedback.length ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl bg-green-50 p-3"><dt className="text-xs text-green-800">採用可</dt><dd className="mt-1 text-2xl font-bold text-green-950">{acceptedCount}</dd></div>
            <div className="rounded-xl bg-amber-50 p-3"><dt className="text-xs text-amber-800">要修正</dt><dd className="mt-1 text-2xl font-bold text-amber-950">{revisionCount}</dd></div>
            <div className="rounded-xl bg-red-50 p-3"><dt className="text-xs text-red-800">作り直し</dt><dd className="mt-1 text-2xl font-bold text-red-950">{unusableCount}</dd></div>
            <div className="rounded-xl bg-violet-50 p-3"><dt className="text-xs text-violet-800">1評価あたり生成数</dt><dd className="mt-1 text-2xl font-bold text-violet-950">{(totalGenerationCount / qualityFeedback.length).toFixed(1)}</dd></div>
            <div className="rounded-xl bg-violet-50 p-3"><dt className="text-xs text-violet-800">記録原価</dt><dd className="mt-1 text-2xl font-bold text-violet-950">${(totalGenerationCostMicros / 1_000_000).toFixed(2)}</dd></div>
          </dl>
        ) : null}
        <div className="mt-4 space-y-3">
          {(feedbackResult.data ?? []).map((item) => (
            <article className="rounded-xl border border-stone-200 p-4" key={item.id}>
              <div className="flex flex-wrap gap-2 text-sm">
                <strong>{profiles.get(item.owner_profile_id)?.display_name || "利用者"}</strong>
                <span>{item.request_type}</span><span>{item.workflow_step}</span><span>評価 {item.rating}/5</span><span>{item.outcome}</span>
              </div>
              {item.title ? <h3 className="mt-2 font-bold">{item.title}</h3> : null}
              {item.target_scope !== "general" && item.verdict ? (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-violet-100 px-2 py-1 font-bold text-violet-900">
                    {item.page_number_snapshot}ページ{item.panel_name_snapshot ? `・${item.panel_name_snapshot}` : "全体"}
                  </span>
                  <span className="rounded-full bg-stone-100 px-2 py-1">{verdictLabels[item.verdict]}</span>
                  <span className="rounded-full bg-stone-100 px-2 py-1">{issueLabels[item.issue_type ?? ""] ?? item.issue_type}</span>
                  <span className="rounded-full bg-stone-100 px-2 py-1">{severityLabels[item.severity ?? ""] ?? item.severity}</span>
                </div>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap break-words text-stone-700">{item.comment}</p>
              {item.target_scope !== "general" ? (
                <p className="mt-2 break-words text-xs text-stone-500">
                  {item.provider_id && item.model_id ? `${item.provider_id} / ${item.model_id}・` : ""}
                  生成 {item.generation_count}回・原価 ${(item.generation_cost_micros / 1_000_000).toFixed(4)} USD・所要 {(item.generation_elapsed_ms / 1000).toFixed(1)}秒
                </p>
              ) : null}
              <p className="mt-2 text-xs text-stone-500">{new Date(item.created_at).toLocaleString("ja-JP")}</p>
              <form action={reviewGeneralMonitorFeedbackAction} className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr_auto]">
                <input name="feedbackId" type="hidden" value={item.id} />
                <select className="field" defaultValue={item.review_status} name="status">
                  <option value="new">未対応</option><option value="reviewing">対応中</option><option value="resolved">対応済み</option>
                </select>
                <input className="field" defaultValue={item.admin_note ?? ""} maxLength={1000} name="adminNote" placeholder="管理メモ（利用者には非表示）" />
                <PendingSubmitButton className="button-secondary" pendingLabel="更新中…">
                  更新
                </PendingSubmitButton>
              </form>
            </article>
          ))}
          {!feedbackResult.data?.length ? <p className="text-stone-600">フィードバックはまだありません。</p> : null}
        </div>
      </section>
    </main>
  );
}
