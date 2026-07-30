import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getCloudGeneralMonitorEnrollment } from "@/lib/cloud-general-monitor";
import { createClient } from "@/lib/supabase/server";
import { submitCloudGeneralMonitorFeedbackAction } from "./actions";

type Feedback = {
  id: string;
  workflow_step: string;
  rating: number;
  outcome: string;
  comment: string;
  created_at: string;
};

export default async function GeneralMonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { profile } = await requireProfile();
  const { error, message } = await searchParams;
  const enrollment = await getCloudGeneralMonitorEnrollment(profile.id);
  const { data: feedback } = await (await createClient())
    .from("cloud_general_monitor_feedback")
    .select("id,workflow_step,rating,outcome,comment,created_at")
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
          使い方を見る
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
          {error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p> : null}
          {message ? <p className="mt-5 rounded-lg bg-green-50 p-4 text-green-800" role="status">{message}</p> : null}
          {enrollment.status === "active" ? (
            <form action={submitCloudGeneralMonitorFeedbackAction} className="panel mt-6 space-y-4">
              <h2 className="text-xl font-bold">使ってみた感想</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="workflowStep">対象工程</label>
                  <select className="field" id="workflowStep" name="workflowStep">
                    <option value="overall">全体</option><option value="research">市場分析</option>
                    <option value="proposal">AI企画</option><option value="scenario">シナリオ</option>
                    <option value="storyboard">ネーム</option><option value="canvas">Canvas</option>
                    <option value="panel_image">コマ画像</option>
                  </select>
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
              </div>
              <textarea className="field min-h-32" maxLength={2000} name="comment" placeholder="良かった点、迷った点、止まった画面など" required />
              <button className="button bg-violet-700 hover:bg-violet-800" type="submit">フィードバックを送信</button>
            </form>
          ) : null}
          <section className="panel mt-6">
            <h2 className="text-xl font-bold">送信履歴</h2>
            <div className="mt-4 space-y-3">
              {(feedback ?? []).map((item) => (
                <article className="rounded-xl border border-stone-200 p-4" key={item.id}>
                  <p className="text-sm font-bold">{item.workflow_step}・{item.rating}/5・{item.outcome}</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-stone-700">{item.comment}</p>
                </article>
              ))}
              {!feedback?.length ? <p className="text-stone-600">まだ送信していません。</p> : null}
            </div>
          </section>
        </>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link className="button-secondary" href="/dashboard/monitor/guide">使い方を見る</Link>
        <Link className="button-secondary" href="/dashboard">ダッシュボードへ戻る</Link>
      </div>
    </main>
  );
}
