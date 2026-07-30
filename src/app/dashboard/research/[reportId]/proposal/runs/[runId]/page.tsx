import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import {
  getCloudProposalRun,
  getCloudProposalSelection,
} from "@/lib/cloud-proposal-server";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { ResourceNotFoundError } from "@/lib/domain-errors";
import { selectCloudProposalAction } from "../../actions";
import { ProposalSelectionButton } from "../../proposal-submit-button";

const direction = {
  best_fit: ["本命案", "市場分析との適合を優先"],
  differentiated: ["差別化案", "競合と違う購入理由を優先"],
  lean_test: ["小さく試す案", "制作負担を抑えて反応を確認"],
} as const;
const fit = {
  strong: "強い",
  balanced: "バランス型",
  challenging: "工夫が必要",
} as const;

export default async function ProposalComparisonPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string; runId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!cloudResearchFeatureEnabled() || !cloudProposalFeatureEnabled())
    redirect("/dashboard/research");
  const { profile } = await requireProfile();
  const { reportId, runId } = await params;
  const query = await searchParams;
  const run = await getCloudProposalRun(profile.id, runId).catch((error) => {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  });
  if (run.research_report_id !== reportId) notFound();
  const selection = await getCloudProposalSelection(profile.id, reportId);
  return (
    <main className="page max-w-7xl">
      <Link className="text-violet-700 underline" href={`/dashboard/research/${reportId}/proposal`}>
        ← AI企画提案へ
      </Link>
      <p className="mt-5 text-sm font-bold text-violet-700">WORKFLOW 2</p>
      <h1 className="mt-2 text-3xl font-bold">企画案を比較</h1>
      <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${run.content_class === "adult" ? "bg-rose-50 text-rose-800" : "bg-violet-50 text-violet-800"}`}>
        {run.content_class === "adult" ? "成人向け" : "一般向け"}
      </span>
      <p className="mt-2 text-stone-600">方向性を比べ、制作する企画を1つ選んでください。</p>
      {query.error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{query.error}</p> : null}
      {query.message ? <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-emerald-800" role="status">{query.message}</p> : null}
      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        {run.result.candidates.map((candidate) => {
          const selected = selection?.candidate_id === candidate.id;
          return (
            <article className={`panel flex flex-col ${selected ? "border-violet-500 ring-2 ring-violet-200" : ""}`} key={candidate.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800">{direction[candidate.direction][0]}</span>
                {selected ? <span className="flex items-center gap-1 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />選択済み</span> : null}
              </div>
              <p className="mt-3 text-sm text-stone-500">{direction[candidate.direction][1]}</p>
              <h2 className="mt-2 break-words text-2xl font-bold">{candidate.title}</h2>
              <p className="mt-3 break-words leading-relaxed text-stone-700">{candidate.logline}</p>
              <dl className="mt-5 grid grid-cols-1 gap-2 text-center text-xs sm:grid-cols-3">
                {[["売れやすさ", fit[candidate.salesFit]], ["作りやすさ", fit[candidate.productionFit]], ["独自性", fit[candidate.originality]]].map(([label, value]) => (
                  <div className="rounded-lg bg-violet-50 p-2" key={label}><dt className="text-stone-500">{label}</dt><dd className="mt-1 font-bold text-violet-900">{value}</dd></div>
                ))}
              </dl>
              <dl className="mt-5 space-y-4 text-sm">
                {[["買われる理由", candidate.whyItCanSell], ["読者が得る体験", candidate.readerPromise], ["主人公", candidate.protagonist], ["主人公の目的", candidate.protagonistGoal], ["中心となる対立", candidate.centralConflict], ["差別化", candidate.differentiation], ["商品設計", candidate.productStrategy], ["結末の方向", candidate.endingDirection]].map(([label, value]) => (
                  <div key={label}><dt className="font-bold">{label}</dt><dd className="mt-1 break-words leading-relaxed text-stone-600">{value}</dd></div>
                ))}
              </dl>
              <div className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-bold">注意点</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">{candidate.tradeoffs.map((value) => <li key={value}>{value}</li>)}</ul>
              </div>
              {!selection ? (
                <form action={selectCloudProposalAction.bind(null, reportId, runId)} className="mt-auto pt-6">
                  <input name="candidateId" type="hidden" value={candidate.id} />
                  <ProposalSelectionButton />
                </form>
              ) : null}
            </article>
          );
        })}
      </section>
      {selection ? (
        <section className="panel mt-6 border-violet-200 bg-violet-50">
          <h2 className="text-xl font-bold">シナリオ生成の準備ができました</h2>
          <p className="mt-2 text-violet-950">選んだ企画は保存済みです。</p>
          <Link className={`button mt-5 ${run.content_class === "adult" ? "bg-rose-700 hover:bg-rose-800" : "bg-violet-700 hover:bg-violet-800"}`} href={`/dashboard/research/${reportId}/proposal/scenario`}>
            {run.content_class === "adult" ? "成人向けシナリオ生成へ進む" : "シナリオ生成へ進む"}
          </Link>
        </section>
      ) : null}
    </main>
  );
}
