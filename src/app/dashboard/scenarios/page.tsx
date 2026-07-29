import Link from "next/link";
import { ArrowRight, FileText, Lock } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { listCloudScenarioRuns } from "@/lib/cloud-scenario-server";

export default async function CloudScenarioHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await requireProfile();
  const { error } = await searchParams;
  const enabled =
    cloudResearchFeatureEnabled() &&
    cloudProposalFeatureEnabled() &&
    cloudScenarioFeatureEnabled();
  const runs = enabled ? await listCloudScenarioRuns(profile.id) : [];

  return (
    <main className="page max-w-5xl">
      <p className="text-sm font-bold text-violet-700">WORKFLOW 3</p>
      <h1 className="mt-2 text-3xl font-bold">シナリオ生成</h1>
      <p className="mt-2 text-stone-600">
        採用企画から生成した初稿と改稿版を管理します。
      </p>
      {error ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {!enabled ? (
        <section className="panel mt-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-stone-400" />
          <h2 className="mt-3 text-xl font-bold">シナリオ生成は現在停止中です</h2>
          <p className="mt-2 text-stone-600">
            前工程とFeature Flagの公開後に利用できます。
          </p>
        </section>
      ) : runs.length ? (
        <section className="mt-6 space-y-3">
          {runs.map((run) => (
            <Link
              className="panel flex flex-col gap-4 transition hover:border-violet-300 sm:flex-row sm:items-center"
              href={`/dashboard/scenarios/${run.id}`}
              key={run.id}
            >
              <FileText className="h-7 w-7 shrink-0 text-violet-700" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold">
                  {run.result.title}・第{run.revision_number}版
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  全{run.result.totalPages}Page／{run.result.scenes.length}シーン
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {new Date(run.completed_at).toLocaleString("ja-JP")}・
                  {run.engine_version}
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
          <FileText className="mx-auto h-8 w-8 text-violet-700" />
          <h2 className="mt-3 text-xl font-bold">シナリオはまだありません</h2>
          <p className="mt-2 text-stone-600">
            AI企画提案で1案を採用し、初稿を生成してください。
          </p>
          <Link className="button-secondary mt-5" href="/dashboard/proposals">
            企画履歴へ
          </Link>
        </section>
      )}
    </main>
  );
}
