import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
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
  if (!cloudResearchFeatureEnabled()) redirect("/dashboard/research");
  const { profile } = await requireProfile();
  const { reportId } = await params;
  const { message } = await searchParams;
  const report = await getCloudResearchReport(profile.id, reportId).catch(
    (error) => {
      if (error instanceof ResourceNotFoundError) notFound();
      throw error;
    },
  );
  const primaryKeys = [
    "winning_direction",
    "why_it_sells",
    "recommended_product",
  ];
  const primaryFindings = primaryKeys
    .map((key) => report.result.findings.find((finding) => finding.key === key))
    .filter((finding) => finding !== undefined);
  const detailFindings = primaryFindings.length
    ? report.result.findings.filter(
        (finding) => !primaryKeys.includes(finding.key),
      )
    : report.result.findings;
  const formatLabel =
    report.input.publicationFormat === "auto"
      ? "AIにおまかせ"
      : report.input.publicationFormat === "series"
        ? "連載"
        : "読切";
  const priceLabel =
    report.input.priceMin === 0 &&
    report.input.priceMax === 0 &&
    report.input.publicationFormat === "auto"
      ? "AIにおまかせ"
      : `${report.input.priceMin.toLocaleString("ja-JP")}〜${report.input.priceMax.toLocaleString("ja-JP")}円`;
  const pageLabel =
    report.input.pageCount === 0
      ? "AIにおまかせ"
      : `${report.input.pageCount}ページ`;

  return (
    <main className="page max-w-5xl">
      <Link className="text-violet-700 underline" href="/dashboard/research">
        ← 市場分析履歴へ
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">市場分析結果</p>
          <h1 className="mt-2 break-words text-3xl font-bold">
            {report.input.genre}・{report.input.theme}
          </h1>
          <p className="mt-2 text-stone-600">
            {new Date(report.completed_at).toLocaleString("ja-JP")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-bold text-stone-700">
            {report.input.contentClass === "adult" ? "成人向け" : "一般向け"}
          </span>
          <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-bold text-green-800">
            分析完了
          </span>
        </div>
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

      {primaryFindings[0] ? (
        <section className="mt-6 rounded-2xl border border-violet-300 bg-gradient-to-br from-violet-700 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
          <p className="text-sm font-bold text-violet-100">
            AIが選んだ、最も売れやすい方向
          </p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
            {primaryFindings[0].label}
          </h2>
          <p className="mt-4 break-words text-lg leading-relaxed text-white">
            {primaryFindings[0].summary}
          </p>
          {primaryFindings.length > 1 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {primaryFindings.slice(1).map((finding) => (
                <article
                  className="rounded-xl bg-white/10 p-4 ring-1 ring-white/20"
                  key={finding.key}
                >
                  <h3 className="font-bold text-violet-100">
                    {finding.label}
                  </h3>
                  <p className="mt-2 break-words leading-relaxed">
                    {finding.summary}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
          <p className="mt-5 text-xs text-violet-100">
            公開情報に基づくAI提案であり、売上を保証するものではありません。
          </p>
        </section>
      ) : null}

      <details className="panel mt-6">
        <summary className="cursor-pointer text-lg font-bold">
          分析に使った希望を見る
        </summary>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["ジャンル", report.input.genre],
            ["想定読者", report.input.audience],
            ["プラットフォーム", report.input.platform],
            [
              "作品区分",
              report.input.contentClass === "adult" ? "成人向け" : "一般向け",
            ],
            ["テーマ", report.input.theme],
            ["作品イメージ", report.input.referenceWorks],
            ["価格帯", priceLabel],
            ["形式", formatLabel],
            ["ページ数", pageLabel],
          ].map(([label, value]) => (
            <div className="rounded-lg bg-stone-50 p-3" key={label}>
              <dt className="text-stone-500">{label}</dt>
              <dd className="mt-1 break-words font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </details>

      <section
        className="mt-6 grid gap-4 lg:grid-cols-2"
        aria-labelledby="research-results-title"
      >
        <h2 className="sr-only" id="research-results-title">
          分析結果
        </h2>
        {detailFindings.map((finding) => (
          <article className="panel" key={finding.key}>
            <h3 className="text-xl font-bold">{finding.label}</h3>
            <p className="mt-3 break-words leading-relaxed text-stone-700">
              {finding.summary}
            </p>
          </article>
        ))}
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
