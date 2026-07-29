import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Lock } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { listCloudResearchReports } from "@/lib/cloud-research-server";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { listCloudProposalRuns } from "@/lib/cloud-proposal-server";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { listCloudScenarioRuns } from "@/lib/cloud-scenario-server";
import { cloudMangaFeatureEnabled } from "@/lib/cloud-manga";
import { listCloudMangaGenerations } from "@/lib/cloud-manga-server";
import {
  cloudWorkManagementFeatureEnabled,
  cloudWorkStatusLabel,
} from "@/lib/cloud-work-management";
import { listCloudManagedWorks } from "@/lib/cloud-work-management-server";
import { cloudSalesPreparationFeatureEnabled } from "@/lib/cloud-sales-preparation";
import { listCloudSalesPreparations } from "@/lib/cloud-sales-preparation-server";

export default async function DashboardPage() {
  const { profile } = await requireProfile();
  const enabled = cloudResearchFeatureEnabled();
  const reports = enabled ? await listCloudResearchReports(profile.id) : [];
  const latest = reports[0];
  const proposalEnabled = enabled && cloudProposalFeatureEnabled();
  const proposalRuns = proposalEnabled
    ? await listCloudProposalRuns(profile.id)
    : [];
  const scenarioEnabled = proposalEnabled && cloudScenarioFeatureEnabled();
  const scenarioRuns = scenarioEnabled
    ? await listCloudScenarioRuns(profile.id)
    : [];
  const mangaEnabled = scenarioEnabled && cloudMangaFeatureEnabled();
  const mangaGenerations = mangaEnabled
    ? await listCloudMangaGenerations(profile.id)
    : [];
  const workManagementEnabled =
    mangaEnabled && cloudWorkManagementFeatureEnabled();
  const managedWorks = workManagementEnabled
    ? await listCloudManagedWorks(profile.id)
    : [];
  const latestManagedWork = managedWorks[0];
  const salesPreparationEnabled =
    workManagementEnabled && cloudSalesPreparationFeatureEnabled();
  const salesPreparations = salesPreparationEnabled
    ? await listCloudSalesPreparations(profile.id)
    : [];
  const latestSalesPreparation = salesPreparations[0];

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
          Release 6
        </span>
      </div>

      <section className="panel mt-7 border-violet-200 shadow-soft">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-violet-700">現在の制作進行</p>
            <h2 className="mt-2 text-2xl font-bold">
              {latest ? "2. AI企画提案" : "1. 市場分析"}
            </h2>
            <p className="mt-2 text-stone-600">
              {latest
                ? "完了した市場分析から3つの企画候補を生成・比較します。"
                : "出典付きの市場分析を保存すると、次のAI企画提案へ進めます。"}
            </p>
          </div>
          {latest && proposalEnabled ? (
            <Link className="button bg-violet-700 hover:bg-violet-800" href={`/dashboard/research/${latest.id}/proposal`}>
              AI企画提案へ
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          ) : enabled ? (
            <Link className="button bg-violet-700 hover:bg-violet-800" href="/dashboard/research/new">
              <BarChart3 className="mr-2 h-5 w-5" />
              市場分析を開始
            </Link>
          ) : (
            <span className="button-secondary text-stone-400">
              <Lock className="mr-2 h-5 w-5" />
              現在停止中
            </span>
          )}
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
          <h2 className="text-xl font-bold">AI企画提案の状況</h2>
          <p className="mt-3 text-3xl font-bold text-violet-800">
            {proposalRuns.length}
            <span className="ml-2 text-sm font-normal text-stone-500">保存済みRun</span>
          </p>
          <Link className="button-secondary mt-5 w-full" href="/dashboard/proposals">
            企画履歴を見る
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </section>
        <section className="panel">
          <h2 className="text-xl font-bold">シナリオ生成の状況</h2>
          <p className="mt-3 text-3xl font-bold text-violet-800">
            {scenarioRuns.length}
            <span className="ml-2 text-sm font-normal text-stone-500">保存済み版</span>
          </p>
          <Link className="button-secondary mt-5 w-full" href="/dashboard/scenarios">
            シナリオ履歴を見る
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </section>
        <section className="panel">
          <h2 className="text-xl font-bold">マンガ下書きの状況</h2>
          <p className="mt-3 text-3xl font-bold text-violet-800">
            {mangaGenerations.length}
            <span className="ml-2 text-sm font-normal text-stone-500">
              Cloud Project
            </span>
          </p>
          <Link className="button-secondary mt-5 w-full" href="/dashboard/manga">
            マンガ下書き履歴を見る
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </section>
        <section className="panel">
          <h2 className="text-xl font-bold">作品管理の状況</h2>
          <p className="mt-3 text-3xl font-bold text-violet-800">
            {managedWorks.length}
            <span className="ml-2 text-sm font-normal text-stone-500">
              管理対象Project
            </span>
          </p>
          <p className="mt-2 text-sm text-stone-600">
            {latestManagedWork
              ? `最新: ${cloudWorkStatusLabel(latestManagedWork.state.status)}`
              : "マンガ下書き生成後に作品管理を開始できます。"}
          </p>
          <Link className="button-secondary mt-5 w-full" href="/dashboard/projects">
            作品管理を開く
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </section>
        <section className="panel">
          <h2 className="text-xl font-bold">販売準備の状況</h2>
          <p className="mt-3 text-3xl font-bold text-violet-800">
            {salesPreparations.length}
            <span className="ml-2 text-sm font-normal text-stone-500">
              承認済みProject
            </span>
          </p>
          <p className="mt-2 text-sm text-stone-600">
            {latestSalesPreparation?.current
              ? "最新Projectは販売下書きへ同期済みです。"
              : latestSalesPreparation
                ? "販売下書きの同期が必要です。"
                : "作品管理で承認後に販売準備へ進めます。"}
          </p>
          <Link
            className="button-secondary mt-5 w-full"
            href="/dashboard/sales-preparation"
          >
            販売準備を開く
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </section>
        <section className="panel lg:col-span-2">
          <h2 className="text-xl font-bold">Release 6 完了条件</h2>
          <ul className="mt-4 space-y-3 text-sm text-stone-700">
            {[
              "制作条件を入力",
              "出典URL・取得日時・確認事実を登録",
              "分析結果を保存",
              "履歴から再表示",
              "3案を比較して1案を採用",
              "初稿・改稿版を保存して1版を確定",
              "全Pageのコマ割り下書きを作成してCanvasで開く",
              "全Pageを確認し、公開前チェックを完了",
              "販売準備への引継ぎを承認",
              "PDF・表紙を生成して販売下書きへ同期",
              "非公開作品と停止中商品の差分を確認",
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
