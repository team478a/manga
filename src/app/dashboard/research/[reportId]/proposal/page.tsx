import Link from "next/link";
import { ArrowRight, CheckCircle2, Lightbulb } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createCloudProposalAction } from "@/app/dashboard/proposals/actions";
import { requireProfile } from "@/lib/auth";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { getCloudResearchReport } from "@/lib/cloud-research-server";
import { ResourceNotFoundError } from "@/lib/domain-errors";

export default async function ProposalHandoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await requireProfile();
  if (!cloudResearchFeatureEnabled()) redirect("/dashboard/research");
  const { reportId } = await params;
  const { error: errorMessage } = await searchParams;
  const report = await getCloudResearchReport(profile.id, reportId).catch(
    (error) => {
      if (error instanceof ResourceNotFoundError) notFound();
      throw error;
    },
  );
  const next = report.result.findings.find(
    (finding) => finding.key === "next_proposal",
  );
  return (
    <main className="page max-w-3xl">
      <Link className="text-violet-700 underline" href={`/dashboard/research/${report.id}`}>
        ← 市場分析Reportへ
      </Link>
      <div className="mt-5 flex items-start gap-3">
        <span className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
          <Lightbulb className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-violet-700">WORKFLOW 2</p>
          <h1 className="mt-1 text-3xl font-bold">3つの企画案を作成</h1>
          <p className="mt-2 text-stone-600">
            市場分析の結果をもとに、方向性の異なる案を比較できます。
          </p>
        </div>
      </div>
      <section className="panel mt-6 border-violet-200">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          市場分析が完了しています
        </div>
        <h2 className="mt-4 text-xl font-bold">企画に反映する条件</h2>
        <p className="mt-3 leading-relaxed text-stone-700">
          {next?.summary ?? "市場分析で整理した読者像と差別化条件を反映します。"}
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          {[
            ["王道案", "市場とのバランスを重視"],
            ["独自案", "差別化と意外性を重視"],
            ["集中案", "読者への伝わりやすさを重視"],
          ].map(([title, description]) => (
            <div className="rounded-lg bg-violet-50 p-3" key={title}>
              <p className="font-bold text-violet-950">{title}</p>
              <p className="mt-1 text-stone-600">{description}</p>
            </div>
          ))}
        </div>
      </section>
      {errorMessage ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {cloudProposalFeatureEnabled() ? (
        <form action={createCloudProposalAction} className="mt-5">
          <input name="reportId" type="hidden" value={report.id} />
          <button
            className="button inline-flex items-center gap-2 bg-violet-700 hover:bg-violet-800"
            type="submit"
          >
            3つの企画案を作成
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <div className="panel mt-5 text-stone-600" role="status">
          AI企画提案はFeature Flagが有効になるまで停止中です。
        </div>
      )}
    </main>
  );
}
