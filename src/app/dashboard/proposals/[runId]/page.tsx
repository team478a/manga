import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { selectCloudProposalAction } from "@/app/dashboard/proposals/actions";
import { createCloudScenarioAction } from "@/app/dashboard/scenarios/actions";
import { requireProfile } from "@/lib/auth";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import {
  getCloudProposalRun,
  getCloudProposalSelection,
} from "@/lib/cloud-proposal-server";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { listCloudScenarioRuns } from "@/lib/cloud-scenario-server";
import { ResourceNotFoundError } from "@/lib/domain-errors";

const directionLabels = {
  balanced: "バランス型",
  differentiated: "差別化型",
  focused: "訴求集中型",
};

export default async function CloudProposalRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { profile } = await requireProfile();
  if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled())
    redirect("/dashboard/proposals");
  const { runId } = await params;
  const query = await searchParams;
  const run = await getCloudProposalRun(profile.id, runId).catch((error) => {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  });
  const selection = await getCloudProposalSelection(
    profile.id,
    run.research_report_id,
  );
  const scenarioEnabled = cloudScenarioFeatureEnabled();
  const scenarioRuns =
    selection && scenarioEnabled
      ? await listCloudScenarioRuns(profile.id, selection.id)
      : [];

  return (
    <main className="page max-w-7xl">
      <Link className="text-violet-700 underline" href="/dashboard/proposals">
        ← 企画履歴へ
      </Link>
      <div className="mt-4">
        <p className="text-sm font-bold text-violet-700">WORKFLOW 2</p>
        <h1 className="mt-2 text-3xl font-bold">企画候補を比較</h1>
        <p className="mt-2 text-stone-600">
          すべて企画仮説（AI推論）です。市場の事実や販売予測ではありません。
        </p>
        <p className="mt-1 text-xs text-stone-500">
          {run.engine_version}／
          {new Date(run.completed_at).toLocaleString("ja-JP")}
        </p>
      </div>
      {query.error ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700" role="alert">
          {query.error}
        </p>
      ) : null}
      {query.message ? (
        <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800" role="status">
          {query.message}
        </p>
      ) : null}
      <section className="mt-6 grid gap-5 xl:grid-cols-3">
        {run.result.candidates.map((candidate) => {
          const selected = selection?.candidate_id === candidate.id;
          return (
            <article
              className={`panel flex flex-col ${selected ? "border-violet-500 ring-2 ring-violet-100" : ""}`}
              key={candidate.id}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">
                  {directionLabels[candidate.direction]}
                </span>
                {selected ? (
                  <span className="inline-flex items-center text-sm font-bold text-green-700">
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    採用済み
                  </span>
                ) : null}
              </div>
              <h2 className="mt-4 text-2xl font-bold">{candidate.title}</h2>
              <p className="mt-3 leading-relaxed text-stone-700">
                {candidate.logline}
              </p>
              <dl className="mt-5 space-y-4 text-sm">
                {[
                  ["読者への約束", candidate.readerPromise],
                  ["主人公", candidate.protagonist],
                  ["中心対立", candidate.centralConflict],
                  ["舞台", candidate.setting],
                  ["差別化", candidate.differentiation],
                  ["形式", candidate.formatPlan],
                  ["販売位置づけ", candidate.salesPositioning],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-bold text-stone-900">{label}</dt>
                    <dd className="mt-1 leading-relaxed text-stone-600">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5">
                <h3 className="text-sm font-bold">確認リスク</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-600">
                  {candidate.risks.map((risk) => <li key={risk}>{risk}</li>)}
                </ul>
              </div>
              {!selection ? (
                <form action={selectCloudProposalAction} className="mt-auto pt-6">
                  <input name="runId" type="hidden" value={run.id} />
                  <input name="candidateId" type="hidden" value={candidate.id} />
                  <button className="button w-full bg-violet-700 hover:bg-violet-800" type="submit">
                    この企画を採用
                  </button>
                </form>
              ) : null}
            </article>
          );
        })}
      </section>
      {selection ? (
        <section className="mt-6 rounded-lg border border-violet-200 bg-violet-50 p-5">
          <h2 className="text-xl font-bold text-violet-950">
            シナリオ生成へ
          </h2>
          <p className="mt-2 text-violet-900">
            採用した企画snapshotを固定しました。この企画からページ配分付きの初稿を作成できます。
          </p>
          {scenarioRuns[0] ? (
            <Link
              className="button mt-4 bg-violet-700 hover:bg-violet-800"
              href={`/dashboard/scenarios/${scenarioRuns[0].id}`}
            >
              最新シナリオを開く
            </Link>
          ) : scenarioEnabled ? (
            <form action={createCloudScenarioAction} className="mt-4">
              <input name="selectionId" type="hidden" value={selection.id} />
              <button className="button bg-violet-700 hover:bg-violet-800" type="submit">
                シナリオ初稿を生成
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm font-bold text-violet-700">
              シナリオ生成はFeature Flagが有効になるまで停止中です。
            </p>
          )}
        </section>
      ) : null}
    </main>
  );
}
