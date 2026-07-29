import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, Sparkles } from "lucide-react";
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
  balanced: {
    label: "王道案",
    description: "市場とのバランスを重視",
  },
  differentiated: {
    label: "独自案",
    description: "差別化と意外性を重視",
  },
  focused: {
    label: "集中案",
    description: "読者への伝わりやすさを重視",
  },
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
        <h1 className="mt-2 text-3xl font-bold">企画案を比較</h1>
        <p className="mt-2 text-stone-600">
          方向性の違いを比べて、制作する企画を1つ選んでください。
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
      <section
        aria-label="企画案の比較"
        className="mt-6 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3"
      >
        {run.result.candidates.map((candidate) => {
          const selected = selection?.candidate_id === candidate.id;
          const direction = directionLabels[candidate.direction];
          return (
            <article
              className={`panel relative flex flex-col overflow-hidden p-0 ${
                selected
                  ? "border-violet-500 ring-2 ring-violet-200"
                  : "hover:border-violet-300"
              }`}
              key={candidate.id}
            >
              <div className="border-b border-violet-100 bg-violet-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-800 shadow-sm">
                    {direction.label}
                  </span>
                  {selected ? (
                    <span className="inline-flex items-center text-sm font-bold text-emerald-700">
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      採用済み
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm font-medium text-violet-800">
                  {direction.description}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-stone-950">
                  {candidate.title}
                </h2>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  作品の核
                </h3>
                <p className="mt-2 leading-relaxed text-stone-700">
                  {candidate.logline}
                </p>
                <dl className="mt-5 space-y-4 text-sm">
                  {[
                    ["読者が得られる体験", candidate.readerPromise],
                    ["主人公", candidate.protagonist],
                    ["乗り越える対立", candidate.centralConflict],
                    ["物語の舞台", candidate.setting],
                    ["この案の強み", candidate.differentiation],
                    ["作品構成", candidate.formatPlan],
                    ["販売方針", candidate.salesPositioning],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="font-bold text-stone-900">{label}</dt>
                      <dd className="mt-1 leading-relaxed text-stone-600">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 rounded-lg bg-amber-50 p-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-amber-950">
                    <CircleAlert className="h-4 w-4" />
                    制作時の注意点
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950/80">
                    {candidate.risks.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                </div>
                {!selection ? (
                  <form action={selectCloudProposalAction} className="mt-auto pt-6">
                    <input name="runId" type="hidden" value={run.id} />
                    <input name="candidateId" type="hidden" value={candidate.id} />
                    <button
                      className="button inline-flex w-full items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800"
                      type="submit"
                    >
                      この企画で進める
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
      {selection ? (
        <section className="mt-6 rounded-lg border border-violet-200 bg-violet-50 p-5">
          <h2 className="flex items-center gap-2 text-xl font-bold text-violet-950">
            <Sparkles className="h-5 w-5" />
            次はシナリオ生成です
          </h2>
          <p className="mt-2 text-violet-900">
            選んだ企画をもとに、人物・三幕構成・シーン・ページ配分を作成できます。
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
