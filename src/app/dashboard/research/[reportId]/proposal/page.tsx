import Link from "next/link";
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
      <p className="mt-5 text-sm font-bold text-violet-700">WORKFLOW 2</p>
      <h1 className="mt-2 text-3xl font-bold">AI企画提案への引継ぎ</h1>
      <section className="panel mt-6 border-violet-200">
        <p className="text-sm font-bold text-violet-700">市場分析完了済み</p>
        <h2 className="mt-2 text-xl font-bold">引継ぎ条件</h2>
        <p className="mt-3 leading-relaxed text-stone-700">{next?.summary}</p>
      </section>
      <div className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-950">
        生成結果は市場の事実ではなく、制作判断のための企画仮説です。参考作品の固有表現は引き継ぎません。
      </div>
      {errorMessage ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {cloudProposalFeatureEnabled() ? (
        <form action={createCloudProposalAction} className="mt-5">
          <input name="reportId" type="hidden" value={report.id} />
          <button className="button bg-violet-700 hover:bg-violet-800" type="submit">
            3つの企画候補を生成して保存
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
