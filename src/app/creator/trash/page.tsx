import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { restoreCloudProjectAction } from "@/app/creator/actions";
import { requireProfile } from "@/lib/auth";
import { listDeletedCloudProjects } from "@/lib/cloud-creator-server";

export default async function CloudProjectTrashPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireProfile();
  const [projects, query] = await Promise.all([
    listDeletedCloudProjects(),
    searchParams,
  ]);
  return (
    <main className="page max-w-4xl">
      <Link className="text-leaf underline" href="/creator">
        ← Project一覧へ
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Cloud Projectのゴミ箱</h1>
      <p className="mt-2 text-stone-600">
        削除から30日以内のProjectを復元できます。
      </p>
      {query.error ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">
          {query.error}
        </p>
      ) : null}
      <section className="mt-6 space-y-3">
        {projects.length ? (
          projects.map((project) => (
            <article
              className="panel flex flex-col gap-3 sm:flex-row sm:items-center"
              key={project.id}
            >
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold">{project.title}</h2>
                <p className="mt-1 text-sm text-stone-600">
                  削除日時:{" "}
                  {new Date(project.deleted_at).toLocaleString("ja-JP")}
                </p>
              </div>
              <form action={restoreCloudProjectAction.bind(null, project.id)}>
                <button className="button" type="submit">
                  <RotateCcw className="mr-2 h-5 w-5" />
                  復元
                </button>
              </form>
            </article>
          ))
        ) : (
          <div className="panel text-center text-stone-600">
            ゴミ箱は空です。
          </div>
        )}
      </section>
    </main>
  );
}
