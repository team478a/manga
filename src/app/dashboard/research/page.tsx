import Link from "next/link";
import { ArrowRight, BarChart3, Lock } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { listCloudResearchReports } from "@/lib/cloud-research-server";

export default async function CloudResearchHistoryPage() {
  const { profile } = await requireProfile();
  const enabled = cloudResearchFeatureEnabled();
  const reports = enabled ? await listCloudResearchReports(profile.id) : [];

  return (
    <main className="page max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">WORKFLOW 1</p>
          <h1 className="mt-2 text-3xl font-bold">市場分析</h1>
          <p className="mt-2 text-stone-600">
            出典と分析条件を保存し、企画提案へ引き継ぎます。
          </p>
        </div>
        {enabled ? (
          <Link className="button bg-violet-700 hover:bg-violet-800" href="/dashboard/research/new">
            新しい市場分析
          </Link>
        ) : null}
      </div>

      {!enabled ? (
        <section className="panel mt-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-stone-400" />
          <h2 className="mt-3 text-xl font-bold">市場分析は現在停止中です</h2>
          <p className="mt-2 text-stone-600">
            Feature Flagが有効になるまで実行できません。
          </p>
        </section>
      ) : reports.length ? (
        <section className="mt-6 space-y-3">
          {reports.map((report) => (
            <Link
              className="panel flex flex-col gap-4 transition hover:border-violet-300 sm:flex-row sm:items-center"
              href={`/dashboard/research/${report.id}`}
              key={report.id}
            >
              <BarChart3 className="h-7 w-7 shrink-0 text-violet-700" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold">
                  {report.input.genre}・{report.input.theme}
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  {report.input.platform}／
                  {report.input.publicationFormat === "series" ? "連載" : "読切"}
                  ／{report.input.pageCount}Page
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {new Date(report.completed_at).toLocaleString("ja-JP")}・出典
                  {report.sources.length}件
                </p>
              </div>
              <span className="inline-flex items-center text-sm font-bold text-violet-700">
                再表示
                <ArrowRight className="ml-1 h-4 w-4" />
              </span>
            </Link>
          ))}
        </section>
      ) : (
        <section className="panel mt-6 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-violet-700" />
          <h2 className="mt-3 text-xl font-bold">保存済みReportはありません</h2>
          <p className="mt-2 text-stone-600">
            最初の市場分析を実行して制作を開始しましょう。
          </p>
          <Link className="button mt-5 bg-violet-700 hover:bg-violet-800" href="/dashboard/research/new">
            市場分析を開始
          </Link>
        </section>
      )}
    </main>
  );
}

