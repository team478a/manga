import Link from "next/link";
import { ArrowRight, Lightbulb, Lock } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { listCloudProposalRuns } from "@/lib/cloud-proposal-server";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";

export default async function CloudProposalHistoryPage() {
  const { profile } = await requireProfile();
  const enabled =
    cloudResearchFeatureEnabled() && cloudProposalFeatureEnabled();
  const runs = enabled ? await listCloudProposalRuns(profile.id) : [];

  return (
    <main className="page max-w-5xl">
      <p className="text-sm font-bold text-violet-700">WORKFLOW 2</p>
      <h1 className="mt-2 text-3xl font-bold">AI企画提案</h1>
      <p className="mt-2 text-stone-600">
        市場分析から生成した企画候補を比較・採用します。
      </p>
      {!enabled ? (
        <section className="panel mt-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-stone-400" />
          <h2 className="mt-3 text-xl font-bold">AI企画提案は現在停止中です</h2>
          <p className="mt-2 text-stone-600">
            Feature Flagと市場分析の公開後に利用できます。
          </p>
        </section>
      ) : runs.length ? (
        <section className="mt-6 space-y-3">
          {runs.map((run) => (
            <Link
              className="panel flex flex-col gap-4 transition hover:border-violet-300 sm:flex-row sm:items-center"
              href={`/dashboard/proposals/${run.id}`}
              key={run.id}
            >
              <Lightbulb className="h-7 w-7 shrink-0 text-violet-700" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold">
                  {run.result.candidates.map((item) => item.title).join("／")}
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  {new Date(run.completed_at).toLocaleString("ja-JP")}・
                  {run.engine_version}
                </p>
              </div>
              <span className="inline-flex items-center text-sm font-bold text-violet-700">
                比較する
                <ArrowRight className="ml-1 h-4 w-4" />
              </span>
            </Link>
          ))}
        </section>
      ) : (
        <section className="panel mt-6 text-center">
          <Lightbulb className="mx-auto h-8 w-8 text-violet-700" />
          <h2 className="mt-3 text-xl font-bold">保存済み企画はありません</h2>
          <p className="mt-2 text-stone-600">
            完了した市場分析Reportから企画候補を生成してください。
          </p>
          <Link className="button-secondary mt-5" href="/dashboard/research">
            市場分析履歴へ
          </Link>
        </section>
      )}
    </main>
  );
}
