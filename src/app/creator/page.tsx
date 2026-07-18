import Link from "next/link";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { listCloudProjects } from "@/lib/cloud-creator-server";

export default async function CloudCreatorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { profile } = await requireProfile();
  if (profile.role !== "creator" && profile.role !== "admin") {
    return (
      <main className="page max-w-3xl">
        <h1 className="text-3xl font-bold">Cloud Creator</h1>
        <p className="panel mt-6 text-lg">
          Cloud Creatorを利用するにはクリエイター登録が必要です。
        </p>
      </main>
    );
  }
  const [projects, query] = await Promise.all([
    listCloudProjects(),
    searchParams,
  ]);
  return (
    <main className="page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold text-leaf">一般漫画・ブラウザー制作</p>
          <h1 className="mt-1 text-3xl font-bold">Cloud Creator</h1>
          <p className="mt-2 text-lg text-stone-600">
            Projectを作成し、EpisodeとPageを編集します。
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="button-secondary" href="/creator/trash">
            <Trash2 className="mr-2 h-5 w-5" />
            ゴミ箱
          </Link>
          <Link className="button" href="/creator/new">
            <Plus className="mr-2 h-5 w-5" />
            新しいProject
          </Link>
        </div>
      </div>
      {query.message ? (
        <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">
          {query.message}
        </p>
      ) : null}
      <p className="mt-6 rounded-md bg-amber-50 p-4 text-amber-950">
        Cloud Creatorは一般向け作品専用です。成人向け作品はMANGAI Desktop
        Adultで制作してください。
      </p>
      {projects.length ? (
        <section className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              className="panel block transition hover:-translate-y-0.5 hover:border-leaf"
              href={`/creator/${project.id}`}
              key={project.id}
            >
              <BookOpen className="h-8 w-8 text-leaf" />
              <h2 className="mt-4 text-xl font-bold">{project.title}</h2>
              <p className="mt-2 line-clamp-2 min-h-12 text-stone-600">
                {project.description || "説明はまだありません。"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm text-stone-600">
                <span className="rounded-full bg-linen px-3 py-1">
                  {project.age_rating}
                </span>
                <span className="rounded-full bg-linen px-3 py-1">
                  {project.source_surface === "desktop"
                    ? "Desktop移行"
                    : "Cloud作成"}
                </span>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="panel mt-7 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-stone-400" />
          <h2 className="mt-4 text-2xl font-bold">Projectはまだありません</h2>
          <p className="mt-2 text-stone-600">
            最初のProjectには第1話と1Page目が自動作成されます。
          </p>
          <Link className="button mt-5" href="/creator/new">
            Projectを作成
          </Link>
        </section>
      )}
    </main>
  );
}
