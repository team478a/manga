import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Lock } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { listCloudResearchReports } from "@/lib/cloud-research-server";
import { getCloudGeneralMonitorEnrollment } from "@/lib/cloud-general-monitor";

export default async function DashboardPage() {
  const enabled = cloudResearchFeatureEnabled();
  const { profile } = await requireProfile();
  const [reports, monitor] = await Promise.all([
    enabled ? listCloudResearchReports(profile.id) : Promise.resolve([]),
    getCloudGeneralMonitorEnrollment(profile.id),
  ]);
  const latest = reports[0];
  const monitorActive = monitor?.status === "active";

  return (
    <main className="page max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">MANGAI Cloud</p>
          <h1 className="mt-2 text-3xl font-bold">ダッシュボード</h1>
          <p className="mt-2 text-stone-600">
            市場分析から販売まで、制作工程を順番に進めます。
          </p>
        </div>
        <span className="rounded-full bg-violet-100 px-4 py-2 text-sm font-bold text-violet-800">
          Release 1
        </span>
      </div>

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
      <section className="panel mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">限定モニター</p>
          <p className="mt-1 text-stone-600">
            {monitor ? `AI利用数 ${monitor.ai_requests_used} / ${monitor.ai_request_limit}` : "招待状況を確認できます。"}
          </p>
        </div>
        <Link className="button-secondary" href="/dashboard/monitor">状況・ご意見</Link>
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
          <h2 className="text-xl font-bold">Release 1 完了条件</h2>
          <ul className="mt-4 space-y-3 text-sm text-stone-700">
            {[
              "制作条件を入力",
              "出典URL・取得日時・確認事実を登録",
              "分析結果を保存",
              "履歴から再表示",
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
