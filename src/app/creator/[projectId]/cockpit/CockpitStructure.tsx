"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  filterCloudCockpitStructure,
  type CloudCockpitChapter,
  type CloudCockpitPageItem,
  type CloudCockpitPageStatus,
  type CloudCockpitStatusFilter,
} from "@/lib/cloud-longform-cockpit";

const PAGE_BATCH = 24;
const statusLabel: Record<CloudCockpitPageStatus, string> = {
  not_started: "未着手", generating: "生成中", review_required: "確認待ち",
  revision_required: "再確認", finalized: "確定",
};
const statusStyle: Record<CloudCockpitPageStatus, string> = {
  not_started: "bg-stone-100 text-stone-700", generating: "bg-violet-100 text-violet-800",
  review_required: "bg-amber-100 text-amber-900", revision_required: "bg-red-100 text-red-800",
  finalized: "bg-green-100 text-green-800",
};

export function CockpitStructure({ projectId, chapters, unassignedPages }: {
  projectId: string;
  chapters: CloudCockpitChapter[];
  unassignedPages: CloudCockpitPageItem[];
}) {
  const [chapterId, setChapterId] = useState("all");
  const [status, setStatus] = useState<CloudCockpitStatusFilter>("all");
  const [limit, setLimit] = useState(PAGE_BATCH);
  const result = useMemo(() => filterCloudCockpitStructure({ chapters, unassignedPages, chapterId, status, limit }), [chapters, unassignedPages, chapterId, status, limit]);
  const visibleIds = useMemo(() => new Set(result.visiblePageIds), [result.visiblePageIds]);
  const resetLimit = () => setLimit(PAGE_BATCH);
  const visibleChapters = chapters.filter((chapter) => chapterId === "all" || chapter.id === chapterId);

  return <>
    <div className="mt-4 grid gap-3 rounded-xl bg-violet-50 p-3 sm:grid-cols-2" aria-label="長編構成の絞り込み">
      <label className="text-sm font-bold">章
        <select className="field mt-1" value={chapterId} onChange={(event) => { setChapterId(event.target.value); resetLimit(); }}>
          <option value="all">すべての章</option>
          {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
          {unassignedPages.length ? <option value="unassigned">シーン未割当</option> : null}
        </select>
      </label>
      <label className="text-sm font-bold">制作状態
        <select className="field mt-1" value={status} onChange={(event) => { setStatus(event.target.value as CloudCockpitStatusFilter); resetLimit(); }}>
          <option value="all">すべての状態</option><option value="attention">確認・修正が必要</option>
          <option value="not_started">未着手</option><option value="generating">生成中</option><option value="finalized">確定</option>
        </select>
      </label>
    </div>
    <p className="mt-3 text-sm text-stone-600" aria-live="polite">{Math.min(result.visiblePageIds.length, result.totalMatches)}/{result.totalMatches}ページを表示</p>
    {result.totalMatches ? <div className="mt-4 space-y-4">{visibleChapters.map((chapter) => {
      const pages = chapter.pages.filter((page) => visibleIds.has(page.id));
      const scenes = chapter.scenes.map((scene) => ({ ...scene, pages: scene.pages.filter((page) => visibleIds.has(page.id)) })).filter((scene) => scene.pages.length);
      if (!pages.length) return null;
      return <details className="min-w-0 rounded-xl border border-stone-200 p-4" key={chapter.id} open>
        <summary className="cursor-pointer font-bold">{chapter.title}<span className="ml-2 text-xs font-normal text-stone-500">{chapter.episodeCount}話・{pages.length}ページ表示</span></summary>
        <div className="mt-3 flex flex-wrap gap-2">{pages.map((page) => <Link className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[page.status]}`} href={`/creator/${projectId}/pages/${page.id}`} key={page.id}>{page.pageNumber}P {statusLabel[page.status]}</Link>)}</div>
        {scenes.length ? <div className="mt-4 space-y-2">{scenes.map((scene) => <div className="min-w-0 rounded-lg bg-stone-50 p-3" key={scene.id}><div className="flex flex-wrap items-center justify-between gap-2"><strong>{scene.title}</strong><span className="text-xs text-stone-500">{scene.pages.map((page) => `${page.pageNumber}P`).join("・")}</span></div>{scene.summary ? <p className="mt-1 break-words text-sm text-stone-600">{scene.summary}</p> : null}</div>)}</div> : null}
      </details>;
    })}
    {chapterId === "unassigned" ? (() => { const pages = unassignedPages.filter((page) => visibleIds.has(page.id)); return pages.length ? <details className="rounded-xl border border-amber-200 bg-amber-50 p-4" open><summary className="cursor-pointer font-bold text-amber-950">シーン未割当（{pages.length}ページ表示）</summary><div className="mt-3 flex flex-wrap gap-2">{pages.map((page) => <Link className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[page.status]}`} href={`/creator/${projectId}/pages/${page.id}`} key={page.id}>{page.pageNumber}P {statusLabel[page.status]}</Link>)}</div></details> : null; })() : null}
    </div> : <p className="mt-4 rounded-lg border border-dashed border-stone-300 p-5 text-stone-600">条件に一致するページはありません。</p>}
    {result.visiblePageIds.length < result.totalMatches ? <button className="button-secondary mt-4 w-full" onClick={() => setLimit((current) => current + PAGE_BATCH)} type="button">次の{Math.min(PAGE_BATCH, result.totalMatches - result.visiblePageIds.length)}ページを表示</button> : null}
  </>;
}
