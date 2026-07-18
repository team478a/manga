import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  FilePlus2,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import {
  addCloudEpisodeAction,
  addCloudPageAction,
  deleteCloudProjectAction,
  deleteCloudStructureAction,
  moveCloudStructureAction,
  renameCloudEpisodeAction,
  renameCloudProjectAction,
  setCloudProjectCoverAction,
} from "@/app/creator/actions";
import { requireProfile } from "@/lib/auth";
import { getCloudProjectWorkspace } from "@/lib/cloud-creator-server";

export default async function CloudProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireProfile();
  const { projectId } = await params;
  const query = await searchParams;
  let workspace: Awaited<ReturnType<typeof getCloudProjectWorkspace>>;
  try {
    workspace = await getCloudProjectWorkspace(projectId);
  } catch {
    notFound();
  }
  const { project, episodes, pages } = workspace;
  return (
    <main className="page">
      <Link className="text-leaf underline" href="/creator">
        ← Project一覧へ
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{project.title}</h1>
          <p className="mt-2 text-stone-600">
            {project.width} × {project.height}px / {project.dpi}dpi・
            {project.reading_direction === "rtl" ? "右綴じ" : "左綴じ"}
          </p>
        </div>
        <span className="rounded-full bg-green-50 px-4 py-2 font-semibold text-green-800">
          一般向けCloud
        </span>
      </div>
      {query.message ? (
        <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">
          {query.message}
        </p>
      ) : null}
      {query.error ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">
          {query.error}
        </p>
      ) : null}
      <details className="panel mt-6">
        <summary className="cursor-pointer text-lg font-bold">
          <PencilLine className="mr-2 inline h-5 w-5" />
          Project情報を編集
        </summary>
        <form
          action={renameCloudProjectAction.bind(null, projectId)}
          className="mt-5 space-y-4"
        >
          <div>
            <label className="label" htmlFor="title">
              Project名
            </label>
            <input
              className="field"
              id="title"
              name="title"
              defaultValue={project.title}
              required
              maxLength={200}
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              説明
            </label>
            <textarea
              className="field min-h-24"
              id="description"
              name="description"
              defaultValue={project.description}
              maxLength={5000}
            />
          </div>
          <button className="button" type="submit">
            更新
          </button>
        </form>
      </details>
      <form
        action={deleteCloudProjectAction.bind(null, projectId)}
        className="mt-3 text-right"
      >
        <button className="button-secondary text-red-700" type="submit">
          <Trash2 className="mr-2 h-5 w-5" />
          Projectをゴミ箱へ移動
        </button>
      </form>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5">
          {episodes.map((episode) => {
            const episodePages = pages.filter(
              (page) => page.episode_id === episode.id,
            );
            return (
              <article className="panel" key={episode.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <form
                    action={renameCloudEpisodeAction.bind(
                      null,
                      projectId,
                      episode.id,
                    )}
                    className="flex min-w-0 flex-1 gap-2"
                  >
                    <input
                      aria-label="Episode名"
                      className="field mt-0 font-bold"
                      name="title"
                      defaultValue={episode.title}
                      required
                      maxLength={200}
                    />
                    <button className="button-secondary shrink-0" type="submit">
                      名前を保存
                    </button>
                  </form>
                  <div className="flex gap-1">
                    <form
                      action={moveCloudStructureAction.bind(
                        null,
                        projectId,
                        "episode",
                        episode.id,
                        -1,
                      )}
                    >
                      <button
                        aria-label="Episodeを上へ"
                        className="button-secondary px-3"
                        type="submit"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    </form>
                    <form
                      action={moveCloudStructureAction.bind(
                        null,
                        projectId,
                        "episode",
                        episode.id,
                        1,
                      )}
                    >
                      <button
                        aria-label="Episodeを下へ"
                        className="button-secondary px-3"
                        type="submit"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </form>
                    <form
                      action={deleteCloudStructureAction.bind(
                        null,
                        projectId,
                        "episode",
                        episode.id,
                      )}
                    >
                      <button
                        aria-label="Episodeを削除"
                        className="button-secondary px-3 text-red-700"
                        type="submit"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {episodePages.map((page) => (
                    <div
                      className="rounded-lg border border-stone-200 bg-linen p-3"
                      key={page.id}
                    >
                      <Link
                        className="block transition hover:text-leaf"
                        href={`/creator/${projectId}/pages/${page.id}`}
                      >
                        <span className="text-sm text-stone-500">PAGE</span>
                        <strong className="mt-1 block text-xl">
                          {page.page_number}ページ
                        </strong>
                        <span className="mt-2 block text-sm text-stone-600">
                          revision {page.revision}
                        </span>
                      </Link>
                      <div className="mt-3 flex gap-1 border-t border-stone-200 pt-2">
                        <form
                          action={setCloudProjectCoverAction.bind(
                            null,
                            projectId,
                            page.id,
                          )}
                        >
                          <button
                            className={`button-secondary min-h-10 px-3 py-2 text-xs ${project.cover_page_id === page.id ? "border-leaf bg-green-50 text-green-800" : ""}`}
                            type="submit"
                          >
                            {project.cover_page_id === page.id
                              ? "表紙"
                              : "表紙に設定"}
                          </button>
                        </form>
                        <form
                          action={moveCloudStructureAction.bind(
                            null,
                            projectId,
                            "page",
                            page.id,
                            -1,
                          )}
                        >
                          <button
                            aria-label="Pageを前へ"
                            className="button-secondary min-h-10 px-3 py-2"
                            type="submit"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                        </form>
                        <form
                          action={moveCloudStructureAction.bind(
                            null,
                            projectId,
                            "page",
                            page.id,
                            1,
                          )}
                        >
                          <button
                            aria-label="Pageを後へ"
                            className="button-secondary min-h-10 px-3 py-2"
                            type="submit"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </form>
                        <form
                          action={deleteCloudStructureAction.bind(
                            null,
                            projectId,
                            "page",
                            page.id,
                          )}
                        >
                          <button
                            aria-label="Pageを削除"
                            className="button-secondary min-h-10 px-3 py-2 text-red-700"
                            type="submit"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
                <form
                  action={addCloudPageAction.bind(null, projectId, episode.id)}
                  className="mt-4"
                >
                  <button className="button-secondary w-full" type="submit">
                    <FilePlus2 className="mr-2 h-5 w-5" />
                    Pageを追加
                  </button>
                </form>
              </article>
            );
          })}
        </section>
        <aside className="space-y-5">
          <form
            action={addCloudEpisodeAction.bind(null, projectId)}
            className="panel"
          >
            <h2 className="text-xl font-bold">Episodeを追加</h2>
            <label className="label mt-4 block" htmlFor="episode-title">
              Episode名
            </label>
            <input
              className="field"
              id="episode-title"
              name="title"
              placeholder="第2話"
              required
              maxLength={200}
            />
            <button className="button mt-4 w-full" type="submit">
              <Plus className="mr-2 h-5 w-5" />
              追加
            </button>
          </form>
          <section className="panel">
            <h2 className="font-bold">Project状況</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-stone-500">Episode</dt>
                <dd className="text-xl font-bold">{episodes.length}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Page</dt>
                <dd className="text-xl font-bold">{pages.length}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Revision</dt>
                <dd className="text-xl font-bold">{project.revision}</dd>
              </div>
              <div>
                <dt className="text-stone-500">使用容量</dt>
                <dd className="text-xl font-bold">
                  {Math.ceil(project.storage_bytes / 1024)} KB
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
