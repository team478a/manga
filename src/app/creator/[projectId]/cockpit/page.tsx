import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BookOpen, CheckCircle2, GitBranch, Users } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getCloudLongformCockpit } from "@/lib/cloud-creator-server";

const statusLabel = {
  not_started: "未着手",
  generating: "生成中",
  review_required: "確認待ち",
  revision_required: "再確認",
  finalized: "確定",
} as const;
const statusStyle = {
  not_started: "bg-stone-100 text-stone-700",
  generating: "bg-violet-100 text-violet-800",
  review_required: "bg-amber-100 text-amber-900",
  revision_required: "bg-red-100 text-red-800",
  finalized: "bg-green-100 text-green-800",
} as const;

export default async function LongformCockpitPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireProfile();
  const { projectId } = await params;
  const data = await getCloudLongformCockpit(projectId).catch(() => null);
  if (!data) notFound();
  const { project, cockpit } = data;
  return (
    <main className="page min-w-0">
      <Link className="text-violet-700 underline" href={`/creator/${projectId}`}>← 作品編集へ</Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-violet-700">長編作品コックピット</p>
          <h1 className="mt-1 break-words text-3xl font-bold">{project.title}</h1>
          <p className="mt-2 text-stone-600">章・シーン・ページ進捗・伏線・人物関係を一画面で確認します。</p>
        </div>
        <Link className="button w-fit" href={`/creator/${projectId}/continuity`}>一貫性台帳を編集</Link>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="作品進捗">
        {[
          ["完成率", `${cockpit.completionPercent}%`], ["全ページ", cockpit.totalPages],
          ["確定", cockpit.finalizedPages], ["生成中", cockpit.generatingPages],
          ["確認・修正待ち", cockpit.reviewPages],
        ].map(([label, value]) => (
          <div className="min-w-0 rounded-xl border border-violet-100 bg-white p-4 shadow-sm" key={label}>
            <p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-2xl font-bold text-violet-800">{value}</p>
          </div>
        ))}
      </section>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="panel min-w-0" aria-labelledby="structure-heading">
          <h2 className="flex items-center gap-2 text-xl font-bold" id="structure-heading"><BookOpen className="h-5 w-5 text-violet-700" />章・シーン進捗</h2>
          {!data.longformAvailable ? <p className="mt-4 rounded-lg bg-amber-50 p-4 text-amber-900">長編構成migrationの適用後に章・シーン別表示を利用できます。</p> : null}
          {cockpit.chapters.length ? <div className="mt-4 space-y-4">{cockpit.chapters.map((chapter) => (
            <article className="min-w-0 rounded-xl border border-stone-200 p-4" key={chapter.id}>
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{chapter.title}</h3><span className="text-xs text-stone-500">{chapter.episodeCount}話・{chapter.pages.length}ページ</span></div>
              <div className="mt-3 flex flex-wrap gap-2">{chapter.pages.map((page) => <Link className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[page.status]}`} href={`/creator/${projectId}/pages/${page.id}`} key={page.id}>{page.pageNumber}P {statusLabel[page.status]}</Link>)}</div>
              {chapter.scenes.length ? <div className="mt-4 space-y-2">{chapter.scenes.map((scene) => <div className="min-w-0 rounded-lg bg-stone-50 p-3" key={scene.id}><div className="flex flex-wrap items-center justify-between gap-2"><strong>{scene.title}</strong><span className="text-xs text-stone-500">{scene.pages.map((page) => `${page.pageNumber}P`).join("・") || "ページ未割当"}</span></div>{scene.summary ? <p className="mt-1 break-words text-sm text-stone-600">{scene.summary}</p> : null}</div>)}</div> : <p className="mt-3 text-sm text-stone-500">シーンはまだありません。</p>}
            </article>
          ))}</div> : <p className="mt-4 rounded-lg border border-dashed border-stone-300 p-5 text-stone-600">章を追加すると、ここに長編構成が表示されます。</p>}
        </section>

        <aside className="min-w-0 space-y-6">
          <section className="panel min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold"><AlertTriangle className="h-5 w-5 text-amber-700" />要確認</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-amber-50 p-3"><dt>一貫性警告</dt><dd className="text-2xl font-bold">{cockpit.issues.length}</dd></div><div className="rounded-lg bg-violet-50 p-3"><dt>未回収の伏線</dt><dd className="text-2xl font-bold">{cockpit.openThreads.length}</dd></div></dl>
            {cockpit.issues.slice(0, 5).map((issue) => <p className="mt-2 break-words rounded-lg bg-amber-50 p-3 text-sm text-amber-950" key={`${issue.code}-${issue.threadId ?? issue.factIds.join("-")}`}>{issue.message}</p>)}
            {!cockpit.issues.length ? <p className="mt-3 flex items-center gap-2 text-sm text-green-800"><CheckCircle2 className="h-4 w-4" />現在、警告はありません。</p> : null}
          </section>
          <section className="panel min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5 text-violet-700" />登場人物</h2>
            <p className="mt-3 break-words text-sm text-stone-700">{cockpit.characterNames.join("、") || "人物設定はまだありません。"}</p>
            <Link className="button-secondary mt-4 inline-flex" href={`/creator/${projectId}/characters`}>人物設定を確認</Link>
          </section>
          <section className="panel min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold"><GitBranch className="h-5 w-5 text-violet-700" />関係・時系列</h2>
            {cockpit.timeline.length ? <ol className="mt-3 space-y-2">{cockpit.timeline.slice(0, 12).map((item) => <li className="break-words border-l-2 border-violet-300 pl-3 text-sm" key={item.id}><strong>{item.startPage}{item.endPage !== item.startPage ? `〜${item.endPage}` : ""}P {item.subject}</strong><span className="mt-1 block text-stone-600">{item.label}</span></li>)}</ol> : <p className="mt-3 text-sm text-stone-600">登録済みの人物関係・時系列はありません。</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}
