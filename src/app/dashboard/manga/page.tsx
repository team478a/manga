import Link from "next/link";
import { BookOpen, Lock } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { cloudMangaFeatureEnabled } from "@/lib/cloud-manga";
import { listCloudMangaGenerations } from "@/lib/cloud-manga-server";
import { cloudProposalFeatureEnabled } from "@/lib/cloud-proposal";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { cloudScenarioFeatureEnabled } from "@/lib/cloud-scenario";

export default async function CloudMangaHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await requireProfile();
  const query = await searchParams;
  const enabled =
    cloudResearchFeatureEnabled() &&
    cloudProposalFeatureEnabled() &&
    cloudScenarioFeatureEnabled() &&
    cloudMangaFeatureEnabled();
  const generations = enabled
    ? await listCloudMangaGenerations(profile.id)
    : [];

  return (
    <main className="page max-w-5xl">
      <p className="text-sm font-bold text-violet-700">WORKFLOW 4</p>
      <h1 className="mt-2 text-3xl font-bold">マンガ下書き生成</h1>
      <p className="mt-2 text-stone-600">
        確定シナリオから作成したPage構成とCanvas下書きを管理します。
      </p>
      {query.error ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700" role="alert">
          {query.error}
        </p>
      ) : null}
      {!enabled ? (
        <section className="panel mt-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-stone-400" />
          <h2 className="mt-3 text-xl font-bold">マンガ下書き生成は停止中です</h2>
          <p className="mt-2 text-stone-600">
            Release 1〜4のFeature Flag有効化後に利用できます。
          </p>
        </section>
      ) : generations.length ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          {generations.map((generation) => (
            <Link
              className="panel block transition hover:border-violet-300"
              href={`/dashboard/manga/${generation.id}`}
              key={generation.id}
            >
              <BookOpen className="h-7 w-7 text-violet-700" />
              <h2 className="mt-3 text-lg font-bold">
                {generation.result.title}
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                {generation.result.totalPages}Page・
                {generation.result.pages.reduce(
                  (sum, page) => sum + page.panelCount,
                  0,
                )}
                コマ
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {new Date(generation.completed_at).toLocaleString("ja-JP")}・
                {generation.engine_version}
              </p>
            </Link>
          ))}
        </section>
      ) : (
        <section className="panel mt-6 text-center">
          <BookOpen className="mx-auto h-9 w-9 text-violet-700" />
          <h2 className="mt-3 text-xl font-bold">マンガ下書きはありません</h2>
          <p className="mt-2 text-stone-600">
            シナリオを確定すると、下書きを生成できます。
          </p>
          <Link className="button-secondary mt-5" href="/dashboard/scenarios">
            シナリオ履歴へ
          </Link>
        </section>
      )}
    </main>
  );
}
