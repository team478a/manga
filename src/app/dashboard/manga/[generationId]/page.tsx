import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getCloudProjectWorkspace } from "@/lib/cloud-creator-server";
import { cloudMangaFeatureEnabled } from "@/lib/cloud-manga";
import { getCloudMangaGeneration } from "@/lib/cloud-manga-server";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";
import { ResourceNotFoundError } from "@/lib/domain-errors";

const roleLabels = {
  opening: "導入",
  development: "展開",
  turning_point: "転換",
  climax: "クライマックス",
  resolution: "結末",
};

const layoutLabels = {
  single: "全面1コマ",
  top_one_bottom_two: "上1＋下2コマ",
  four_equal: "4コマ",
  six_equal: "6コマ",
};

export default async function CloudMangaGenerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ generationId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { profile } = await requireProfile();
  if (
    !cloudResearchFeatureEnabled() ||
    !cloudProposalFeatureEnabled() ||
    !cloudScenarioFeatureEnabled() ||
    !cloudMangaFeatureEnabled()
  )
    redirect("/dashboard/manga");
  const { generationId } = await params;
  const query = await searchParams;
  const generation = await getCloudMangaGeneration(
    profile.id,
    generationId,
  ).catch((error) => {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  });
  const workspace = await getCloudProjectWorkspace(generation.project_id);
  const pagesByNumber = new Map(
    workspace.pages.map((page) => [page.page_number, page]),
  );

  return (
    <main className="page max-w-6xl">
      <Link className="text-violet-700 underline" href="/dashboard/manga">
        ← マンガ下書き履歴へ
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">WORKFLOW 4</p>
          <h1 className="mt-2 text-3xl font-bold">{generation.result.title}</h1>
          <p className="mt-2 text-stone-600">
            {generation.result.totalPages}Page／
            {generation.result.pages.reduce(
              (sum, page) => sum + page.panelCount,
              0,
            )}
            コマ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="button-secondary"
            href={`/creator/${generation.project_id}`}
          >
            Cloud Projectを開く
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
          <Link
            className="button"
            href={`/dashboard/projects/${generation.project_id}`}
          >
            作品管理へ
          </Link>
        </div>
      </div>
      {query.message ? (
        <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800" role="status">
          {query.message}
        </p>
      ) : null}
      <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        このコマ割りは{generation.engine_version}によるAI推論・制作仮説です。
        外部画像生成は自動実行していません。
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {generation.result.pages.map((plan) => {
          const page = pagesByNumber.get(plan.pageNumber);
          return (
            <article className="panel" key={plan.pageNumber}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Page {plan.pageNumber}</h2>
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800">
                  {roleLabels[plan.pageRole]}
                </span>
              </div>
              <p className="mt-3 font-bold">{plan.sceneHeading}</p>
              <p className="mt-2 line-clamp-3 text-sm text-stone-600">
                {plan.sceneSummary}
              </p>
              <p className="mt-3 text-sm text-stone-700">
                {layoutLabels[plan.layoutId]}・{plan.panelCount}コマ
              </p>
              {page ? (
                <Link
                  className="button-secondary mt-4 w-full"
                  href={`/creator/${generation.project_id}/pages/${page.id}`}
                >
                  Canvasで編集
                </Link>
              ) : (
                <p className="mt-4 text-sm text-red-700">
                  対応Pageが見つかりません。
                </p>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
