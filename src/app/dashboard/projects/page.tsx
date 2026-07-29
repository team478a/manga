import Link from "next/link";
import { ArrowRight, BookOpenCheck, Lock } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import {
  cloudWorkManagementFeatureEnabled,
  cloudWorkStatusLabel,
} from "@/lib/cloud-work-management";
import { listCloudManagedWorks } from "@/lib/cloud-work-management-server";

export default async function CloudProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { profile } = await requireProfile();
  const query = await searchParams;
  const enabled = cloudWorkManagementFeatureEnabled();
  const works = enabled ? await listCloudManagedWorks(profile.id) : [];
  return (
    <main className="page max-w-7xl">
      <div>
        <p className="text-sm font-bold text-violet-700">Release 5</p>
        <h1 className="mt-2 text-3xl font-bold">作品管理</h1>
        <p className="mt-2 text-stone-600">
          Cloud Projectをページ単位で確認し、販売準備へ渡す前の状態を管理します。
        </p>
      </div>
      {query.message ? (
        <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-emerald-800">
          {query.message}
        </p>
      ) : null}
      {query.error ? (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">
          {query.error}
        </p>
      ) : null}
      {!enabled ? (
        <section className="panel mt-7 text-center">
          <Lock className="mx-auto h-10 w-10 text-stone-400" />
          <h2 className="mt-4 text-xl font-bold">作品管理は現在停止中です</h2>
          <p className="mt-2 text-stone-600">
            Feature Flagが有効になるまで、既存のCloud Creatorをご利用ください。
          </p>
        </section>
      ) : works.length ? (
        <section className="mt-7 grid gap-4 lg:grid-cols-2">
          {works.map(({ project, state }) => (
            <article className="panel" key={project.id}>
              <div className="flex items-start justify-between gap-4">
                <BookOpenCheck className="h-8 w-8 shrink-0 text-violet-700" />
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    state.status === "approved"
                      ? "bg-emerald-100 text-emerald-800"
                      : state.status === "review_ready"
                        ? "bg-violet-100 text-violet-800"
                        : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {cloudWorkStatusLabel(state.status)}
                </span>
              </div>
              <h2 className="mt-4 text-xl font-bold">{project.title}</h2>
              <p className="mt-2 line-clamp-2 min-h-12 text-sm text-stone-600">
                {project.description || "作品説明はまだありません。"}
              </p>
              <div className="mt-4 flex items-center justify-between text-sm text-stone-500">
                <span>Project revision {project.revision}</span>
                <span>{project.cover_page_id ? "表紙設定済み" : "表紙未設定"}</span>
              </div>
              <Link
                className="button-secondary mt-5 w-full"
                href={`/dashboard/projects/${project.id}`}
              >
                公開前チェックを開く
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel mt-7 text-center">
          <BookOpenCheck className="mx-auto h-10 w-10 text-stone-400" />
          <h2 className="mt-4 text-xl font-bold">管理対象の作品はありません</h2>
          <p className="mt-2 text-stone-600">
            マンガ下書きを生成するか、Cloud CreatorでProjectを作成してください。
          </p>
          <Link className="button mt-5" href="/dashboard/manga">
            マンガ生成へ
          </Link>
        </section>
      )}
    </main>
  );
}
