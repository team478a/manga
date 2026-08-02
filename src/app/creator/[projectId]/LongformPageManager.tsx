"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, FilePlus2, GripVertical, LayoutGrid, PanelsTopLeft, Pause, Play, Plus, RotateCcw, Sparkles, Trash2, XCircle } from "lucide-react";
import type { CloudEpisode, CloudGenerationBatch, CloudLongformStructure, CloudPage, CloudPageProductionState, CloudPageProductionStatus } from "@/lib/cloud-creator-server";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import {
  addCloudEpisodeToChapterAction,
  addCloudPageToSceneAction,
  addCloudSceneAction,
  deleteCloudStructureAction,
  moveCloudPageBeforeAction,
  setCloudProjectCoverAction,
  retryFailedCloudGenerationJobAction,
  setCloudPageProductionStatusAction,
  setCloudGenerationBatchStateAction,
  startCloudPageGenerationBatchAction,
} from "@/app/creator/actions";

const PAGE_BATCH = 12;

export function LongformPageManager({
  projectId,
  readingDirection,
  coverPageId,
  episodes,
  pages,
  structure,
  batches,
  productionStates,
}: {
  projectId: string;
  readingDirection: "rtl" | "ltr";
  coverPageId: string | null;
  episodes: CloudEpisode[];
  pages: CloudPage[];
  structure: CloudLongformStructure;
  batches: CloudGenerationBatch[];
  productionStates: CloudPageProductionState[];
}) {
  const [view, setView] = useState<"single" | "spread">("single");
  const [visibleCount, setVisibleCount] = useState(PAGE_BATCH);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [moveMessage, setMoveMessage] = useState("");
  const [isMoving, startMove] = useTransition();
  const [filter, setFilter] = useState<"all" | "attention" | "generating" | "finalized">("all");
  const orderedPages = useMemo(() => [...pages].sort((a, b) => a.page_number - b.page_number), [pages]);
  const stateByPage = useMemo(() => new Map(productionStates.map((state) => [state.pageId, state])), [productionStates]);
  const statusOf = (pageId: string): CloudPageProductionStatus => stateByPage.get(pageId)?.status ?? "not_started";
  const filteredPages = useMemo(() => orderedPages.filter((page) => {
    const state = stateByPage.get(page.id);
    if (filter === "all") return true;
    if (filter === "attention") return state?.isStale || state?.status === "review_required" || state?.status === "revision_required";
    return state?.status === filter;
  }), [filter, orderedPages, stateByPage]);
  const visibleIds = useMemo(() => new Set(filteredPages.slice(0, visibleCount).map((page) => page.id)), [filteredPages, visibleCount]);
  const finalizedCount = productionStates.filter((state) => state.status === "finalized" && !state.isStale).length;
  const attentionCount = productionStates.filter((state) => state.isStale || state.status === "review_required" || state.status === "revision_required").length;
  const generatingCount = productionStates.filter((state) => state.status === "generating").length;
  const progress = pages.length ? Math.round((finalizedCount / pages.length) * 100) : 0;

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
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-violet-50 p-3"><p className="text-xs text-stone-600">完成進捗</p><strong className="text-2xl text-violet-800">{progress}%</strong><div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full bg-violet-600" style={{ width: `${progress}%` }} /></div></div>
          <div className="rounded-lg border border-stone-200 p-3"><p className="text-xs text-stone-600">確定</p><strong>{finalizedCount}/{pages.length}ページ</strong></div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs text-amber-800">要確認・要修正</p><strong>{attentionCount}ページ</strong></div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="text-xs text-blue-800">生成中</p><strong>{generatingCount}ページ</strong></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="制作状態で絞り込み">
          {([['all','すべて'],['attention','確認が必要'],['generating','生成中'],['finalized','確定済み']] as const).map(([key,label]) => <button className={filter === key ? "button" : "button-secondary"} key={key} onClick={() => { setFilter(key); setVisibleCount(PAGE_BATCH); }} type="button">{label}</button>)}
        </div>
        <p className="mt-3 text-sm" aria-live="polite">{isMoving ? "ページを移動しています…" : moveMessage || `${Math.min(visibleCount, filteredPages.length)}/${filteredPages.length}ページを表示`}</p>
      </div>

      <form action={startCloudPageGenerationBatchAction.bind(null, projectId)} className="panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-lg font-bold">4〜8ページをまとめて生成</h3><p className="mt-1 text-sm text-stone-600">下のページにチェックを付けて開始します。各ページの全コマを既存の安全な生成Queueへ登録します。</p></div>
          <PendingSubmitButton className="button shrink-0" pendingLabel="生成を登録しています…"><Sparkles className="mr-2 h-4 w-4" />選択ページを生成</PendingSubmitButton>
        </div>
        <p className="mt-2 text-xs text-stone-500">最大64コマ。画面を閉じてもWorker処理は継続します。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {orderedPages.filter((page) => visibleIds.has(page.id)).map((page) => <label className={`flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-sm ${statusOf(page.id) === "finalized" ? "opacity-50" : ""}`} key={page.id}><input disabled={statusOf(page.id) === "finalized"} name="pageId" type="checkbox" value={page.id} />{page.page_number}ページ</label>)}
        </div>
      </form>

      {batches.length ? <section className="panel" aria-label="一括生成履歴"><h3 className="text-lg font-bold">一括生成の進行状況</h3><div className="mt-3 space-y-3">{batches.map((batch) => <article className="rounded-lg border border-stone-200 p-3" key={batch.id}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><strong>{batch.status === "paused" ? "一時停止中" : batch.status === "canceled" ? "中止" : batch.status === "completed" ? "完了" : "処理中"}</strong><p className="text-sm text-stone-600">完了 {batch.completedJobs}/{batch.totalJobs}・待機 {batch.queuedJobs}・処理中 {batch.runningJobs}・失敗 {batch.failedJobs}</p></div><div className="flex flex-wrap gap-2">
          {batch.status === "active" ? <form action={setCloudGenerationBatchStateAction.bind(null, projectId, batch.id, "paused")}><PendingSubmitButton className="button-secondary" pendingLabel="停止中…"><Pause className="mr-1 h-4 w-4" />一時停止</PendingSubmitButton></form> : batch.status === "paused" ? <form action={setCloudGenerationBatchStateAction.bind(null, projectId, batch.id, "active")}><PendingSubmitButton className="button-secondary" pendingLabel="再開中…"><Play className="mr-1 h-4 w-4" />再開</PendingSubmitButton></form> : null}
          {batch.status === "active" || batch.status === "paused" ? <form action={setCloudGenerationBatchStateAction.bind(null, projectId, batch.id, "canceled")}><PendingSubmitButton className="button-secondary text-red-700" pendingLabel="中止中…"><XCircle className="mr-1 h-4 w-4" />中止</PendingSubmitButton></form> : null}
        </div></div>
        {(batch.status === "active" || batch.status === "paused") && batch.failedJobIds.length ? <div className="mt-3 flex flex-wrap gap-2">{batch.failedJobIds.map((jobId, index) => <form action={retryFailedCloudGenerationJobAction.bind(null, projectId, jobId)} key={jobId}><PendingSubmitButton className="button-secondary" pendingLabel="再登録中…"><RotateCcw className="mr-1 h-4 w-4" />失敗{index + 1}を再実行</PendingSubmitButton></form>)}</div> : null}
      </article>)}</div></section> : null}

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
                                  {(() => { const state = stateByPage.get(page.id); const status = state?.status ?? "not_started"; const labels: Record<CloudPageProductionStatus,string> = { not_started: "未着手", generating: "生成中", review_required: "要確認", revision_required: "要修正", finalized: "確定" }; return <>
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-1"><span className={`rounded-full px-2 py-1 text-xs font-bold ${status === "finalized" ? "bg-green-100 text-green-800" : status === "revision_required" || state?.isStale ? "bg-amber-100 text-amber-900" : status === "generating" ? "bg-blue-100 text-blue-800" : "bg-stone-100 text-stone-700"}`}>{labels[status]}</span>{state?.isStale ? <span className="flex items-center gap-1 text-xs font-bold text-amber-800"><AlertTriangle className="h-3 w-3" />設定変更あり</span> : null}</div>
                                  <div className="relative mx-auto aspect-[2/3] w-full max-w-36 rounded border border-stone-300 bg-gradient-to-br from-white to-stone-100">
                                    <GripVertical className="absolute left-1 top-1 h-4 w-4 text-stone-400" />
                                    {page.thumbnail_url ? (
                                      // Signed private URLs are short-lived and cannot be configured as a static image origin.
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img alt={`${page.page_number}ページのプレビュー`} className="h-full w-full rounded object-contain" src={page.thumbnail_url} />
                                    ) : <span className="absolute inset-0 grid place-items-center text-2xl font-bold text-stone-300">{page.page_number}</span>}
                                    {coverPageId === page.id ? <span className="absolute bottom-1 left-1 rounded bg-violet-700 px-2 py-1 text-xs font-bold text-white">表紙</span> : null}
                                  </div>
                                  {status === "finalized" ? <p className="mt-2 text-center text-sm font-bold text-green-800"><CheckCircle2 className="mr-1 inline h-4 w-4" />編集ロック中</p> : <Link className="mt-2 block text-center font-bold text-violet-800 underline" href={`/creator/${projectId}/pages/${page.id}`}>{page.page_number}ページを編集</Link>}
                                  <div className="mt-2 flex flex-wrap justify-center gap-1" dir="ltr">
                                    {status === "finalized" ? <form action={setCloudPageProductionStatusAction.bind(null, projectId, page.id, "revision_required")}><PendingSubmitButton className="button-secondary min-h-9 px-2 py-1 text-xs" pendingLabel="再開中…">編集を再開</PendingSubmitButton></form> : status === "review_required" ? <><form action={setCloudPageProductionStatusAction.bind(null, projectId, page.id, "revision_required")}><PendingSubmitButton className="button-secondary min-h-9 px-2 py-1 text-xs" pendingLabel="更新中…">要修正</PendingSubmitButton></form><form action={setCloudPageProductionStatusAction.bind(null, projectId, page.id, "finalized")}><PendingSubmitButton className="button-secondary min-h-9 px-2 py-1 text-xs" pendingLabel="確定中…">確定</PendingSubmitButton></form></> : status !== "generating" ? <form action={setCloudPageProductionStatusAction.bind(null, projectId, page.id, "review_required")}><PendingSubmitButton className="button-secondary min-h-9 px-2 py-1 text-xs" pendingLabel="更新中…">確認待ちへ</PendingSubmitButton></form> : null}
                                  </div>
                                  <div className="mt-2 flex justify-center gap-1" dir="ltr">
                                    <form action={setCloudProjectCoverAction.bind(null, projectId, page.id)}><button className="button-secondary min-h-9 px-2 py-1 text-xs" type="submit">表紙</button></form>
                                    <form action={deleteCloudStructureAction.bind(null, projectId, "page", page.id)}><button aria-label={`${page.page_number}ページを削除`} className="button-secondary min-h-9 px-2 py-1 text-red-700" type="submit"><Trash2 className="h-4 w-4" /></button></form>
                                  </div>
                                  </>; })()}
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
      {visibleCount < filteredPages.length ? <button className="button-secondary w-full" onClick={() => setVisibleCount((count) => count + PAGE_BATCH)} type="button">次の{Math.min(PAGE_BATCH, filteredPages.length - visibleCount)}ページを表示</button> : null}
    </section>
  );
}
