import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Lock, Megaphone } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { listCloudResearchReports } from "@/lib/cloud-research-server";
import { createClient } from "@/lib/supabase/server";
import {
  getCloudGeneralMonitorEnrollment,
  getCloudGeneralMonitorNotice,
  isCloudGeneralMonitorActive,
} from "@/lib/cloud-general-monitor";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const enabled = cloudResearchFeatureEnabled();
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const { message } = await searchParams;
  const [reportsResult, monitorResult, updatesQueryResult, notificationsQueryResult] = await Promise.allSettled([
    enabled ? listCloudResearchReports(profile.id) : Promise.resolve([]),
    getCloudGeneralMonitorEnrollment(profile.id),
    supabase.from("cloud_product_updates")
      .select("id,title,summary,category,action_url,published_at")
      .order("published_at", { ascending: false })
      .limit(3),
    supabase.from("cloud_ai_notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .is("read_at", null),
  ]);
  const reports = reportsResult.status === "fulfilled" ? reportsResult.value : [];
  const monitor = monitorResult.status === "fulfilled" ? monitorResult.value : null;
  const updatesResult = updatesQueryResult.status === "fulfilled"
    ? updatesQueryResult.value
    : { data: null, error: true };
  const notificationsResult = notificationsQueryResult.status === "fulfilled"
    ? notificationsQueryResult.value
    : { count: 0, error: true };
  const latest = reports[0];
  const monitorActive = isCloudGeneralMonitorActive(monitor) &&
    Boolean(monitor && monitor.ai_requests_used < monitor.ai_request_limit);
  const monitorNotice = getCloudGeneralMonitorNotice(monitor);

  return (
    <main className="page max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">MANGAI Cloud</p>
          <h1 className="mt-2 text-3xl font-bold">ダッシュボード</h1>
          <p className="mt-2 text-stone-600">
            市場分析から原稿編集まで、制作工程を順番に進めます。
          </p>
        </div>
        <span className="rounded-full bg-violet-100 px-4 py-2 text-sm font-bold text-violet-800">
          一般向けモニター
        </span>
      </div>

      {message ? (
        <p className="mt-5 rounded-xl bg-green-50 p-4 text-green-800" role="status">
          {message}
        </p>
      ) : null}

      <section className="panel mt-7 border-violet-200 shadow-soft">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-violet-700">現在の制作進行</p>
            <h2 className="mt-2 text-2xl font-bold">1. 市場分析</h2>
            <p className="mt-2 text-stone-600">
              出典付きの市場分析を保存すると、次のAI企画提案へ進めます。
            </p>
          </div>
          {enabled && monitorActive ? (
            <Link className="button bg-violet-700 hover:bg-violet-800" href="/dashboard/research/new">
              <BarChart3 className="mr-2 h-5 w-5" />
              市場分析を開始
            </Link>
          ) : (
            <span className="button-secondary text-stone-400">
              <Lock className="mr-2 h-5 w-5" />
              {enabled ? "招待が必要です" : "現在停止中"}
            </span>
          )}
        </div>
      </section>
      {monitorActive && monitor && !monitor.onboarding_completed_at ? (
        <section className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-5">
          <h2 className="font-bold text-violet-950">初回案内が未確認です</h2>
          <p className="mt-1 text-sm text-violet-900">利用条件と制作の進め方を確認してから開始してください。</p>
          <Link className="button mt-4 bg-violet-700 hover:bg-violet-800" href="/dashboard/monitor/welcome">初回案内を確認</Link>
        </section>
      ) : null}
      {monitorNotice ? (
        <p className={`mt-5 rounded-xl p-4 ${monitorNotice.level === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-950"}`} role="status">
          {monitorNotice.message}
        </p>
      ) : null}
      {!updatesResult.error && updatesResult.data?.length ? (
        <section className="panel mt-5 border-violet-200">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-violet-700" />
            <h2 className="text-xl font-bold">更新情報</h2>
          </div>
          <div className="mt-4 divide-y divide-stone-200">
            {updatesResult.data.map((item) => (
              <article className="py-4 first:pt-0 last:pb-0" key={item.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold text-violet-700">
                      {item.category === "release" ? "新機能" : item.category === "improvement" ? "改善" : item.category === "fix" ? "不具合修正" : "メンテナンス"}
                    </p>
                    <h3 className="mt-1 font-bold">{item.title}</h3>
                    <p className="mt-1 text-sm text-stone-600">{item.summary}</p>
                  </div>
                  <p className="shrink-0 text-xs text-stone-500">{item.published_at ? new Date(item.published_at).toLocaleDateString("ja-JP") : ""}</p>
                </div>
                {item.action_url ? <Link className="mt-2 inline-flex text-sm font-semibold text-violet-700" href={item.action_url}>関連画面を見る →</Link> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <section className="panel mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">限定モニター</p>
          <p className="mt-1 text-stone-600">
            {monitor ? `AI利用数 ${monitor.ai_requests_used} / ${monitor.ai_request_limit}` : "招待状況を確認できます。"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className="button-secondary" href="/dashboard/monitor/guide">使い方</Link>
          <Link className="button-secondary" href="/dashboard/monitor">状況・ご意見</Link>
          <Link className="button-secondary" href="/dashboard/notifications">通知 {notificationsResult.count ?? 0}件</Link>
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="panel">
          <h2 className="text-xl font-bold">市場分析の状況</h2>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-violet-50 p-4">
              <dt className="text-sm text-stone-500">保存済みReport</dt>
              <dd className="mt-1 text-3xl font-bold text-violet-800">
                {reports.length}
              </dd>
            </div>
            <div className="rounded-lg bg-violet-50 p-4">
              <dt className="text-sm text-stone-500">次工程</dt>
              <dd className="mt-2 font-bold">
                {latest ? "準備完了" : "市場分析待ち"}
              </dd>
            </div>
          </dl>
          <Link className="button-secondary mt-5 w-full" href="/dashboard/research">
            分析履歴を見る
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </section>
        <section className="panel">
          <h2 className="text-xl font-bold">市場分析の完了条件</h2>
          <ul className="mt-4 space-y-3 text-sm text-stone-700">
            {[
              "ジャンルとテーマを選択",
              "AIが売れやすい方向を分析",
              "分析結果を保存",
              "AI企画提案へ引き継ぐ",
            ].map((item) => (
              <li className="flex items-center gap-2" key={item}>
                <CheckCircle2 className="h-4 w-4 text-violet-600" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
