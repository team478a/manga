import Link from "next/link";
import { BookOpen, FilePenLine, ListTree, Plus, Trash2 } from "lucide-react";
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
        <h1 className="text-3xl font-bold">クラウド制作</h1>
        <p className="panel mt-6 text-lg">
          クラウド制作を利用するにはクリエイター登録が必要です。
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
          <h1 className="mt-1 text-3xl font-bold">クラウド制作</h1>
          <p className="mt-2 text-lg text-stone-600">
            作品を作成し、話とページを編集します。
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="button-secondary" href="/creator/trash">
            <Trash2 className="mr-2 h-5 w-5" />
            ゴミ箱
          </Link>
          <Link className="button" href="/creator/new">
            <Plus className="mr-2 h-5 w-5" />
            新しい作品
          </Link>
        </div>
      </div>
      {query.message ? (
        <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">
          {query.message}
        </p>
      ) : null}
      <p className="mt-6 rounded-md bg-amber-50 p-4 text-amber-950">
        クラウド制作は一般向け作品専用です。成人向け作品はMANGAI
        Desktop Adultで制作してください。
      </p>
      <section
        aria-labelledby="creator-start-guide"
        className="panel mt-6 border-violet-200 bg-violet-50/60"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-violet-700">
              はじめての方へ
            </p>
            <h2 id="creator-start-guide" className="mt-1 text-xl font-bold">
              まずはこの3ステップで作品を作ります
            </h2>
          </div>
          {!projects.length ? (
            <Link className="button" href="/creator/new">
              <Plus className="mr-2 h-5 w-5" />
              作品づくりを始める
            </Link>
          ) : null}
        </div>
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          <li className="rounded-lg border border-violet-100 bg-white p-4">
            <BookOpen className="h-6 w-6 text-violet-600" />
            <p className="mt-3 text-sm font-semibold text-violet-700">
              ステップ1
            </p>
            <h3 className="mt-1 font-bold">作品を作成</h3>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              タイトルと基本設定を入力します。第1話と1ページ目は自動で作られます。
            </p>
          </li>
          <li className="rounded-lg border border-violet-100 bg-white p-4">
            <ListTree className="h-6 w-6 text-violet-600" />
            <p className="mt-3 text-sm font-semibold text-violet-700">
              ステップ2
            </p>
            <h3 className="mt-1 font-bold">話とページを整理</h3>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              必要に応じて話やページを追加し、作品の構成を整えます。
            </p>
          </li>
          <li className="rounded-lg border border-violet-100 bg-white p-4">
            <FilePenLine className="h-6 w-6 text-violet-600" />
            <p className="mt-3 text-sm font-semibold text-violet-700">
              ステップ3
            </p>
            <h3 className="mt-1 font-bold">ページを編集</h3>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              ページを開き、画像・コマ・吹き出し・文字を配置して保存します。
            </p>
          </li>
        </ol>
      </section>
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
                    ? "デスクトップから移行"
                    : "クラウドで作成"}
                </span>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="panel mt-7 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-stone-400" />
          <h2 className="mt-4 text-2xl font-bold">作品はまだありません</h2>
          <p className="mt-2 text-stone-600">
            「作品づくりを始める」からタイトルを入力してください。第1話と1ページ目は自動で作られます。
          </p>
          <Link className="button mt-5" href="/creator/new">
            作品を作成
          </Link>
        </section>
      )}
    </main>
  );
}
