import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, ExternalLink } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { getCloudResearchReport } from "@/lib/cloud-research-server";
import { ResourceNotFoundError } from "@/lib/domain-errors";

export default async function CloudResearchReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { profile } = await requireProfile();
  if (!cloudResearchFeatureEnabled()) redirect("/dashboard/research");
  const { reportId } = await params;
  const { message } = await searchParams;
  const report = await getCloudResearchReport(profile.id, reportId).catch(
    (error) => {
      if (error instanceof ResourceNotFoundError) notFound();
      throw error;
    },
  );

  return (
    <main className="page max-w-5xl">
      <Link className="text-violet-700 underline" href="/dashboard/research">
        ← 市場分析履歴へ
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">市場分析Report</p>
          <h1 className="mt-2 text-3xl font-bold">
            {report.input.genre}・{report.input.theme}
          </h1>
          <p className="mt-2 text-stone-600">
            {new Date(report.completed_at).toLocaleString("ja-JP")}／
            {report.engine_version}
          </p>
        </div>
        <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-bold text-green-800">
          分析完了
        </span>
      </div>
      {message ? (
        <p
          aria-live="polite"
          className="mt-5 rounded-md bg-green-50 p-4 text-green-800"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <section className="panel mt-6">
        <h2 className="text-xl font-bold">入力条件</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["ジャンル", report.input.genre],
            ["想定読者", report.input.audience],
            ["プラットフォーム", report.input.platform],
            ["テーマ", report.input.theme],
            ["参考作品", report.input.referenceWorks],
            ["価格帯", `${report.input.priceMin.toLocaleString("ja-JP")}〜${report.input.priceMax.toLocaleString("ja-JP")}円`],
            ["形式", report.input.publicationFormat === "series" ? "連載" : "読切"],
            ["ページ数", `${report.input.pageCount}Page`],
          ].map(([label, value]) => (
            <div className="rounded-lg bg-stone-50 p-3" key={label}>
              <dt className="text-stone-500">{label}</dt>
              <dd className="mt-1 font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {report.result.findings.map((finding) => (
          <article className="panel" key={finding.key}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold">{finding.label}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                finding.classification === "fact"
                  ? "bg-blue-50 text-blue-800"
                  : "bg-violet-100 text-violet-800"
              }`}>
                {finding.classification === "fact" ? "事実／入力条件" : "AI推論"}
              </span>
            </div>
            <p className="mt-3 leading-relaxed text-stone-700">{finding.summary}</p>
            <p className="mt-4 text-xs text-stone-500">
              根拠URL {finding.sourceUrls.length}件
            </p>
          </article>
        ))}
      </section>

      <section className="panel mt-6">
        <h2 className="text-xl font-bold">出典</h2>
        <div className="mt-4 space-y-4">
          {report.sources.map((source) => (
            <article className="rounded-lg border border-stone-200 p-4" key={source.url}>
              <a className="font-bold text-violet-700 underline" href={source.url} rel="noreferrer" target="_blank">
                {source.title}
                <ExternalLink className="ml-1 inline h-4 w-4" />
              </a>
              <p className="mt-2 text-sm text-stone-700">{source.fact}</p>
              <p className="mt-2 text-xs text-stone-500">
                取得日時: {new Date(source.retrievedAt).toLocaleString("ja-JP")}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-violet-200 bg-violet-50 p-5">
        <h2 className="text-xl font-bold text-violet-950">次のAI企画提案へ</h2>
        <p className="mt-2 text-violet-900">
          市場分析が完了したため、推奨条件を次工程へ引き継げます。
        </p>
        <Link className="button mt-4 bg-violet-700 hover:bg-violet-800" href={`/dashboard/research/${report.id}/proposal`}>
          AI企画提案の準備へ
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
