"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { BookOpen, FilePlus2, GripVertical, LayoutGrid, PanelsTopLeft, Plus, Trash2 } from "lucide-react";
import type { CloudChapter, CloudEpisode, CloudLongformStructure, CloudPage } from "@/lib/cloud-creator-server";
import {
  addCloudEpisodeToChapterAction,
  addCloudPageToSceneAction,
  addCloudSceneAction,
  deleteCloudStructureAction,
  moveCloudPageBeforeAction,
  setCloudProjectCoverAction,
} from "@/app/creator/actions";

const PAGE_BATCH = 12;

export function LongformPageManager({
  projectId,
  readingDirection,
  coverPageId,
  episodes,
  pages,
  structure,
}: {
  projectId: string;
  readingDirection: "rtl" | "ltr";
  coverPageId: string | null;
  episodes: CloudEpisode[];
  pages: CloudPage[];
  structure: CloudLongformStructure;
}) {
  const [view, setView] = useState<"single" | "spread">("single");
  const [visibleCount, setVisibleCount] = useState(PAGE_BATCH);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [moveMessage, setMoveMessage] = useState("");
  const [isMoving, startMove] = useTransition();
  const orderedPages = useMemo(() => [...pages].sort((a, b) => a.page_number - b.page_number), [pages]);
  const visibleIds = useMemo(() => new Set(orderedPages.slice(0, visibleCount).map((page) => page.id)), [orderedPages, visibleCount]);

  const moveBefore = (targetPageId: string) => {
    if (!draggedPageId || draggedPageId === targetPageId) return;
    setMoveMessage("ページを移動しています…");
    startMove(async () => {
      try {
        await moveCloudPageBeforeAction(projectId, draggedPageId, targetPageId);
        setMoveMessage("ページ順を更新しました。");
      } catch {
        setMoveMessage("同じ話の中でのみページを移動できます。");
      } finally {
        setDraggedPageId(null);
      }
    });
  };

  return (
    <section className="space-y-5" aria-labelledby="longform-pages">
      <div className="panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold" id="longform-pages">
              <BookOpen className="h-5 w-5 text-violet-700" />
              32ページ制作ボード
            </h2>
            <p className="mt-2 text-sm text-stone-600">章・話・シーンで原稿を整理します。カードをドラッグすると同じ話の中で順番を変更できます。</p>
          </div>
          <div className="flex rounded-lg border border-violet-200 bg-white p-1" aria-label="ページ表示方式">
            <button className={`rounded-md px-3 py-2 text-sm font-bold ${view === "single" ? "bg-violet-100 text-violet-800" : "text-stone-600"}`} onClick={() => setView("single")} type="button"><LayoutGrid className="mr-1 inline h-4 w-4" />単ページ</button>
            <button className={`rounded-md px-3 py-2 text-sm font-bold ${view === "spread" ? "bg-violet-100 text-violet-800" : "text-stone-600"}`} onClick={() => setView("spread")} type="button"><PanelsTopLeft className="mr-1 inline h-4 w-4" />見開き</button>
          </div>
        </div>
        <p className="mt-3 text-sm" aria-live="polite">{isMoving ? "ページを移動しています…" : moveMessage || `${Math.min(visibleCount, pages.length)}/${pages.length}ページを表示`}</p>
      </div>

      {structure.chapters.map((chapter) => {
        const chapterEpisodes = episodes.filter((episode) => structure.episodeChapterIds[episode.id] === chapter.id);
        return (
          <article className="rounded-xl border border-violet-200 bg-violet-50/40 p-4" key={chapter.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-bold">{chapter.title}</h3>
              <form action={addCloudEpisodeToChapterAction.bind(null, projectId, chapter.id)} className="flex gap-2">
                <input aria-label={`${chapter.title}へ追加する話の名前`} className="field mt-0 min-w-0" maxLength={200} name="title" placeholder="新しい話" required />
                <button className="button-secondary shrink-0" type="submit"><Plus className="mr-1 inline h-4 w-4" />話を追加</button>
              </form>
            </div>
            <div className="mt-4 space-y-4">
              {chapterEpisodes.map((episode) => {
                const episodeScenes = structure.scenes.filter((scene) => scene.episode_id === episode.id);
                return (
                  <section className="rounded-xl border border-stone-200 bg-white p-4" key={episode.id}>
                    <h4 className="text-lg font-bold">{episode.title}</h4>
                    <div className="mt-4 space-y-4">
                      {episodeScenes.map((scene) => {
                        const scenePages = orderedPages.filter((page) => structure.pageSceneIds[page.id] === scene.id && visibleIds.has(page.id));
                        return (
                          <section className="rounded-lg border border-stone-200 bg-stone-50 p-3" key={scene.id}>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div><h5 className="font-bold">{scene.title}</h5>{scene.summary ? <p className="mt-1 text-sm text-stone-600">{scene.summary}</p> : null}</div>
                              <form action={addCloudPageToSceneAction.bind(null, projectId, scene.id)}><button className="button-secondary" type="submit"><FilePlus2 className="mr-1 inline h-4 w-4" />ページ追加</button></form>
                            </div>
                            <div className={`mt-3 grid gap-3 ${view === "spread" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4"}`} dir={view === "spread" && readingDirection === "rtl" ? "rtl" : "ltr"}>
                              {scenePages.map((page) => (
                                <article className="group rounded-lg border border-stone-200 bg-white p-2 shadow-sm" draggable onDragEnd={() => setDraggedPageId(null)} onDragOver={(event) => event.preventDefault()} onDragStart={() => setDraggedPageId(page.id)} onDrop={() => moveBefore(page.id)} key={page.id}>
                                  <div className="relative mx-auto aspect-[2/3] w-full max-w-36 rounded border border-stone-300 bg-gradient-to-br from-white to-stone-100">
                                    <GripVertical className="absolute left-1 top-1 h-4 w-4 text-stone-400" />
                                    <span className="absolute inset-0 grid place-items-center text-2xl font-bold text-stone-300">{page.page_number}</span>
                                    {coverPageId === page.id ? <span className="absolute bottom-1 left-1 rounded bg-violet-700 px-2 py-1 text-xs font-bold text-white">表紙</span> : null}
                                  </div>
                                  <Link className="mt-2 block text-center font-bold text-violet-800 underline" href={`/creator/${projectId}/pages/${page.id}`}>{page.page_number}ページを編集</Link>
                                  <div className="mt-2 flex justify-center gap-1" dir="ltr">
                                    <form action={setCloudProjectCoverAction.bind(null, projectId, page.id)}><button className="button-secondary min-h-9 px-2 py-1 text-xs" type="submit">表紙</button></form>
                                    <form action={deleteCloudStructureAction.bind(null, projectId, "page", page.id)}><button aria-label={`${page.page_number}ページを削除`} className="button-secondary min-h-9 px-2 py-1 text-red-700" type="submit"><Trash2 className="h-4 w-4" /></button></form>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                    <details className="mt-4 rounded-lg border border-dashed border-stone-300 p-3">
                      <summary className="cursor-pointer font-semibold">シーンを追加</summary>
                      <form action={addCloudSceneAction.bind(null, projectId, episode.id)} className="mt-3 grid gap-2 sm:grid-cols-2">
                        <input className="field mt-0" maxLength={200} name="title" placeholder="シーン名" required />
                        <input className="field mt-0" maxLength={2000} name="summary" placeholder="場面の概要（任意）" />
                        <button className="button-secondary sm:col-span-2" type="submit">追加</button>
                      </form>
                    </details>
                  </section>
                );
              })}
            </div>
          </article>
        );
      })}
      {visibleCount < pages.length ? <button className="button-secondary w-full" onClick={() => setVisibleCount((count) => count + PAGE_BATCH)} type="button">次の{Math.min(PAGE_BATCH, pages.length - visibleCount)}ページを表示</button> : null}
    </section>
  );
}
