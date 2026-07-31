import Link from "next/link";
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
      .select("id,owner_profile_id,workflow_step,rating,outcome,comment,created_at,review_status,admin_note")
      .order("created_at", { ascending: false }).limit(100).returns<Feedback[]>(),
    admin.from("profiles").select("id,display_name").returns<Profile[]>(),
  ]);
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));

  return (
    <main className="page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold text-violet-700">一般向け・無料限定公開</p>
          <h1 className="mt-1 text-3xl font-bold">モニター管理</h1>
          <p className="mt-2 text-stone-600">招待、期限、AI利用数、感想を確認します。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="button-secondary" href="/admin/general-monitors/guide">スタッフマニュアル</Link>
          <Link className="button-secondary" href="/admin/general-monitors/email">招待メール設定</Link>
          <Link className="button-secondary" href="/admin/general-monitors/export">CSV出力</Link>
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
        <div className="mt-4 space-y-3">
          {(feedbackResult.data ?? []).map((item) => (
            <article className="rounded-xl border border-stone-200 p-4" key={item.id}>
              <div className="flex flex-wrap gap-2 text-sm">
                <strong>{profiles.get(item.owner_profile_id)?.display_name || "利用者"}</strong>
                <span>{item.workflow_step}</span><span>評価 {item.rating}/5</span><span>{item.outcome}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-stone-700">{item.comment}</p>
              <p className="mt-2 text-xs text-stone-500">{new Date(item.created_at).toLocaleString("ja-JP")}</p>
              <form action={reviewGeneralMonitorFeedbackAction} className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr_auto]">
                <input name="feedbackId" type="hidden" value={item.id} />
                <select className="field" defaultValue={item.review_status} name="status">
                  <option value="new">未対応</option><option value="reviewing">対応中</option><option value="resolved">対応済み</option>
                </select>
                <input className="field" defaultValue={item.admin_note ?? ""} maxLength={1000} name="adminNote" placeholder="管理メモ（利用者には非表示）" />
                <button className="button-secondary" type="submit">更新</button>
              </form>
            </article>
          ))}
          {!feedbackResult.data?.length ? <p className="text-stone-600">フィードバックはまだありません。</p> : null}
        </div>
      </section>
    </main>
  );
}
