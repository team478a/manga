import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { getCloudResearchReport } from "@/lib/cloud-research-server";
import { ResourceNotFoundError } from "@/lib/domain-errors";

export default async function ProposalHandoffPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { profile } = await requireProfile();
  if (!cloudResearchFeatureEnabled()) redirect("/dashboard/research");
  const { reportId } = await params;
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
        AI企画生成はRelease 2で実装します。Release 1では、完了Reportからの安全な引継ぎ確認までが対象です。
      </div>
    </main>
  );
}
