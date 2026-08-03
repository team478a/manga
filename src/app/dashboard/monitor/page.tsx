import Link from "next/link";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import { getCloudGeneralMonitorEnrollment, getCloudGeneralMonitorNotice } from "@/lib/cloud-general-monitor";
import { createClient } from "@/lib/supabase/server";
import { submitCloudGeneralMonitorFeedbackAction } from "./actions";

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
};

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

export default async function GeneralMonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { profile } = await requireProfile();
  const { error, message } = await searchParams;
  const enrollment = await getCloudGeneralMonitorEnrollment(profile.id);
  const notice = getCloudGeneralMonitorNotice(enrollment);
  const { data: feedback } = await (await createClient())
    .from("cloud_general_monitor_feedback")
    .select("id,workflow_step,rating,outcome,comment,created_at,target_scope,page_number_snapshot,panel_name_snapshot,verdict,request_type,title,severity")
    .eq("owner_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<Feedback[]>();

  return (
    <main className="page max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold text-violet-700">一般向け・招待制</p>
          <h1 className="mt-1 text-3xl font-bold">モニター状況とご意見</h1>
        </div>
        <Link className="button-secondary" href="/dashboard/monitor/guide">
          Webマニュアル
        </Link>
      </div>
      {!enrollment ? (
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">招待されたアカウントでログインしてください</h2>
          <p className="mt-2 text-stone-600">
            モニター登録前はAI制作機能を利用できません。
          </p>
        </section>
      ) : (
        <>
          <section className="panel mt-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><p className="text-sm text-stone-500">状態</p><p className="font-bold">{enrollment.status}</p></div>
              <div><p className="text-sm text-stone-500">AI利用数</p><p className="font-bold">{enrollment.ai_requests_used} / {enrollment.ai_request_limit}</p></div>
              <div><p className="text-sm text-stone-500">期限</p><p className="font-bold">{new Date(enrollment.expires_at).toLocaleDateString("ja-JP")}</p></div>
            </div>
          </section>
          {notice ? <p className={`mt-5 rounded-lg p-4 ${notice.level === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-950"}`} role="status">{notice.message}</p> : null}
          {!enrollment.onboarding_completed_at ? <Link className="button mt-5 bg-violet-700 hover:bg-violet-800" href="/dashboard/monitor/welcome">初回案内を確認</Link> : null}
          {error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p> : null}
          {message ? <p className="mt-5 rounded-lg bg-green-50 p-4 text-green-800" role="status">{message}</p> : null}
          {enrollment.status === "active" ? (
            <form action={submitCloudGeneralMonitorFeedbackAction} className="panel mt-6 space-y-4">
              <h2 className="text-xl font-bold">感想・不具合・ご要望を送る</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="requestType">報告の種類</label>
                  <select className="field" id="requestType" name="requestType">
                    <option value="feedback">感想</option><option value="bug">不具合報告</option>
                    <option value="improvement">改善依頼</option><option value="feature_request">機能リクエスト</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="workflowStep">対象工程</label>
                  <select className="field" id="workflowStep" name="workflowStep">
                    <option value="overall">全体</option><option value="research">市場分析</option>
                    <option value="proposal">AI企画</option><option value="scenario">シナリオ</option>
                    <option value="storyboard">ネーム</option><option value="canvas">Canvas</option>
                    <option value="panel_image">コマ画像</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="feedback-title">件名</label>
                  <input className="field" id="feedback-title" maxLength={160} name="title" placeholder="例：市場分析の結果画面から先へ進めない" required />
                </div>
                <div>
                  <label className="label" htmlFor="rating">評価</label>
                  <select className="field" id="rating" name="rating">
                    <option value="5">5 とても良い</option><option value="4">4 良い</option>
                    <option value="3">3 普通</option><option value="2">2 改善が必要</option>
                    <option value="1">1 利用できない</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="outcome">結果</label>
                  <select className="field" id="outcome" name="outcome">
                    <option value="very_useful">とても役立った</option><option value="useful">役立った</option>
                    <option value="neutral">どちらでもない</option><option value="difficult">操作が難しい</option>
                    <option value="blocked">途中で進めなかった</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="severity">影響</label>
                  <select className="field" id="severity" name="severity">
                    <option value="none">影響なし</option><option value="minor">少し困る</option>
                    <option value="major">大きく困る</option><option value="blocked">作業を続けられない</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="environment">利用環境（任意）</label>
                  <input className="field" id="environment" maxLength={200} name="environment" placeholder="例：iPhone Safari / Windows Chrome" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="pageUrl">発生した画面URL（任意）</label>
                  <input className="field" id="pageUrl" maxLength={500} name="pageUrl" placeholder="https://app.mang-ai.com/..." />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="feedback-comment">詳しい内容</label>
                <textarea className="field min-h-32" id="feedback-comment" maxLength={2000} name="comment" placeholder="何をした時に、何が起きたか。期待していた結果も入力してください。" required />
              </div>
              <PendingSubmitButton
                className="button bg-violet-700 hover:bg-violet-800"
                pendingLabel="フィードバックを送信中…"
              >
                フィードバックを送信
              </PendingSubmitButton>
            </form>
          ) : null}
          <section className="panel mt-6">
            <h2 className="text-xl font-bold">送信履歴</h2>
            <div className="mt-4 space-y-3">
              {(feedback ?? []).map((item) => (
                <article className="rounded-xl border border-stone-200 p-4" key={item.id}>
                  <p className="text-sm font-bold">{requestTypeLabels[item.request_type]}・{item.workflow_step}・{item.rating}/5</p>
                  {item.title ? <h3 className="mt-1 font-bold">{item.title}</h3> : null}
                  {item.target_scope !== "general" ? (
                    <p className="mt-1 text-xs font-semibold text-violet-800">
                      {item.page_number_snapshot}ページ{item.panel_name_snapshot ? `・${item.panel_name_snapshot}` : "全体"}・{item.verdict ? qualityVerdictLabels[item.verdict] : "評価済み"}
                    </p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap break-words text-stone-700">{item.comment}</p>
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
