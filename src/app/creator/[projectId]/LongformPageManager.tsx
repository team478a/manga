"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, FilePlus2, GripVertical, LayoutGrid, PanelsTopLeft, Pause, Play, Plus, RotateCcw, Sparkles, Trash2, XCircle } from "lucide-react";
import type { CloudEpisode, CloudGenerationBatch, CloudLongformStructure, CloudPage, CloudPageProductionState, CloudPageProductionStatus } from "@/lib/cloud-creator-server";
import type { GenerationBatchPreflightContext } from "@/modules/manga/domain/generation-batch-preflight";
import { estimateGenerationBatch } from "@/modules/manga/domain/generation-batch-preflight";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import {
  addCloudEpisodeToChapterAction,
  addCloudPageToSceneAction,
  addCloudSceneAction,
  deleteCloudStructureAction,
  moveCloudPageBeforeAction,
  setCloudProjectCoverAction,
  retryFailedCloudGenerationJobAction,
  retryFailedCloudGenerationBatchTargetsAction,
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
  batchPreflight,
}: {
  projectId: string;
  readingDirection: "rtl" | "ltr";
  coverPageId: string | null;
  episodes: CloudEpisode[];
  pages: CloudPage[];
  structure: CloudLongformStructure;
  batches: CloudGenerationBatch[];
  productionStates: CloudPageProductionState[];
  batchPreflight: GenerationBatchPreflightContext | null;
}) {
  const [view, setView] = useState<"single" | "spread">("single");
  const [visibleCount, setVisibleCount] = useState(PAGE_BATCH);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [moveMessage, setMoveMessage] = useState("");
  const [isMoving, startMove] = useTransition();
  const [filter, setFilter] = useState<"all" | "attention" | "generating" | "finalized">("all");
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
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
  const batchEstimate = useMemo(
    () => batchPreflight ? estimateGenerationBatch(batchPreflight, selectedPageIds) : null,
    [batchPreflight, selectedPageIds],
  );
  const cost = batchEstimate?.maxReservedCostMicros === null || batchEstimate?.maxReservedCostMicros === undefined
    ? "確認できません"
    : new Intl.NumberFormat("ja-JP", { style: "currency", currency: batchPreflight?.currency ?? "USD" })
      .format(batchEstimate.maxReservedCostMicros / 1_000_000);

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
          {([['all','すべて'],['attention','確認が必要'],['generating','生成中'],['finalized','確定済み']] as const).map(([key,label]) => <button className={filter === key ? "button" : "button-secondary"} key={key} onClick={() => { setFilter(key); setVisibleCount(PAGE_BATCH); setSelectedPageIds([]); }} type="button">{label}</button>)}
        </div>
        <p className="mt-3 text-sm" aria-live="polite">{isMoving ? "ページを移動しています…" : moveMessage || `${Math.min(visibleCount, filteredPages.length)}/${filteredPages.length}ページを表示`}</p>
      </div>

      <form action={startCloudPageGenerationBatchAction.bind(null, projectId)} className="panel" id="page-generation">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-lg font-bold">4〜8ページをまとめて生成</h3><p className="mt-1 text-sm text-stone-600">下のページにチェックを付けて開始します。各ページの全コマを既存の安全な生成Queueへ登録します。</p></div>
          <PendingSubmitButton className="button shrink-0" disabled={!batchEstimate?.canStart} pendingLabel="生成を登録しています…"><Sparkles className="mr-2 h-4 w-4" />選択ページを生成</PendingSubmitButton>
        </div>
        {batchPreflight && batchEstimate ? <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm" aria-live="polite">
          <p className="font-bold">開始前の生成見積り</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <p>対象: <strong>{batchEstimate.selectedPageCount}ページ／{batchEstimate.targetPanelCount}コマ</strong></p>
            <p>候補: <strong>1案／コマ</strong></p>
            <p>必要credit: <strong>{batchEstimate.requiredCredits ?? "確認不可"}</strong>（残り{batchPreflight.planCreditsRemaining ?? "確認不可"}）</p>
            <p>作品credit: <strong>{batchPreflight.projectCreditsRemaining ?? "上限設定なし"}</strong></p>
            <p>モニターAI残り: <strong>{batchPreflight.monitorRequestsRemaining ?? "確認不可"}回</strong></p>
            <p>最大予約費用: <strong>{cost}</strong></p>
            <p>Model: <strong>{batchPreflight.modelId ?? "確認不可"}</strong></p>
            <p>料金版: <strong>{batchPreflight.pricingVersion ?? "確認不可"}</strong></p>
            <p>Worker: <strong>最短{batchEstimate.schedulerRuns}回／約{batchEstimate.schedulerMinimumMinutes}分</strong></p>
            <p>1分Job化上限: <strong>{batchEstimate.registrationLimit ?? "確認不可"}コマ</strong></p>
          </div>
          <p className="mt-2 text-xs text-stone-600">最大予約費用は実際の請求額ではありません。全コマを先に永続登録し、Workerが1分上限と5分間隔・1回3Jobを守って段階的にJob化します。</p>
          <div className="mt-3 rounded-lg border border-stone-200 bg-white p-3">
            <p className="font-bold">生成前のビジュアル準備</p>
            <p className="mt-1 text-xs text-stone-600">画風・線・陰影・背景密度・構図と、主要人物の年齢感・体格・髪・衣装・固定特徴を確認します。</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <p>作品画風: <strong>{batchPreflight.styleBibleConfigured ? "設定済み" : "未設定"}</strong></p>
              <p>登場人物の外見・衣装: <strong>{batchEstimate.requiredCharacterNames.length - batchEstimate.missingCharacterNames.length}/{batchEstimate.requiredCharacterNames.length}名設定済み</strong></p>
            </div>
            {batchEstimate.missingCharacterNames.length ? <p className="mt-2 text-amber-900">未設定: {batchEstimate.missingCharacterNames.join("、")}</p> : null}
            {(!batchPreflight.styleBibleConfigured || batchEstimate.missingCharacterNames.length) ? <div className="mt-3 flex flex-wrap gap-2">
              {!batchPreflight.styleBibleConfigured ? <Link className="button-secondary" href={`/creator/${projectId}/bible`}>画風・世界観を設定</Link> : null}
              {batchEstimate.missingCharacterNames.length ? <Link className="button-secondary" href={`/creator/${projectId}/characters`}>キャラクター設定を追加</Link> : null}
            </div> : null}
          </div>
          {batchEstimate.blockers.length ? <ul className="mt-2 list-disc pl-5 text-amber-900">{batchEstimate.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p className="mt-2 font-bold text-green-800"><CheckCircle2 className="mr-1 inline h-4 w-4" />現在の利用枠では開始できます。</p>}
        </div> : <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="mr-1 inline h-4 w-4" />生成料金と利用枠を確認できないため、一括生成を開始できません。</div>}
        <p className="mt-2 text-xs text-stone-500">最大64コマ。画面を閉じてもWorker処理は継続します。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {orderedPages.filter((page) => visibleIds.has(page.id)).map((page) => <label className={`flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-sm ${statusOf(page.id) === "finalized" ? "opacity-50" : ""}`} key={page.id}><input checked={selectedPageIds.includes(page.id)} disabled={statusOf(page.id) === "finalized"} name="pageId" onChange={(event) => setSelectedPageIds((current) => event.target.checked ? [...current, page.id] : current.filter((id) => id !== page.id))} type="checkbox" value={page.id} />{page.page_number}ページ（{batchPreflight?.pagePanelCounts[page.id] ?? "?"}コマ）</label>)}
        </div>
      </form>

      {batches.length ? <section className="panel" aria-label="一括生成履歴"><h3 className="text-lg font-bold">一括生成の進行状況</h3><div className="mt-3 space-y-3">{batches.map((batch) => <article className="rounded-lg border border-stone-200 p-3" key={batch.id}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><strong>{batch.status === "paused" ? "一時停止中" : batch.status === "canceled" ? "中止" : batch.status === "completed" ? "完了" : "処理中"}</strong><p className="text-sm text-stone-600">Job化待ち {batch.pendingTargets}・Job化済み {batch.totalJobs}・完了 {batch.completedJobs}・待機 {batch.queuedJobs}・処理中 {batch.runningJobs}・失敗 {batch.failedJobs + batch.failedTargets}</p><p className="text-xs text-stone-500">選択{batch.requested_page_ids.length}ページ。画面を閉じても未Job化コマは保持されます。</p></div><div className="flex flex-wrap gap-2">
          {batch.status === "active" ? <form action={setCloudGenerationBatchStateAction.bind(null, projectId, batch.id, "paused")}><PendingSubmitButton className="button-secondary" pendingLabel="停止中…"><Pause className="mr-1 h-4 w-4" />一時停止</PendingSubmitButton></form> : batch.status === "paused" ? <form action={setCloudGenerationBatchStateAction.bind(null, projectId, batch.id, "active")}><PendingSubmitButton className="button-secondary" pendingLabel="再開中…"><Play className="mr-1 h-4 w-4" />再開</PendingSubmitButton></form> : null}
          {batch.status === "active" || batch.status === "paused" ? <form action={setCloudGenerationBatchStateAction.bind(null, projectId, batch.id, "canceled")}><PendingSubmitButton className="button-secondary text-red-700" pendingLabel="中止中…"><XCircle className="mr-1 h-4 w-4" />中止</PendingSubmitButton></form> : null}
        </div></div>
        {(batch.status === "active" || batch.status === "paused") && batch.failedJobIds.length ? <div className="mt-3 flex flex-wrap gap-2">{batch.failedJobIds.map((jobId, index) => <form action={retryFailedCloudGenerationJobAction.bind(null, projectId, jobId)} key={jobId}><PendingSubmitButton className="button-secondary" pendingLabel="再登録中…"><RotateCcw className="mr-1 h-4 w-4" />失敗{index + 1}を再実行</PendingSubmitButton></form>)}</div> : null}
        {(batch.status === "active" || batch.status === "paused") && batch.failedTargets > 0 ? <form action={retryFailedCloudGenerationBatchTargetsAction.bind(null, projectId, batch.id)} className="mt-3"><PendingSubmitButton className="button-secondary" pendingLabel="再登録中…"><RotateCcw className="mr-1 h-4 w-4" />Job化失敗{batch.failedTargets}コマを再実行</PendingSubmitButton></form> : null}
      </article>)}</div></section> : null}

      {structure.chapters.map((chapter) => {
        const chapterEpisodes = episodes.filter((episode) => structure.episodeChapterIds[episode.id] === chapter.id);
        return (
          <article className="rounded-xl border border-violet-200 bg-violet-50/40 p-4" key={chapter.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-bold">{chapter.title}</h3>
              <form action={addCloudEpisodeToChapterAction.bind(null, projectId, chapter.id)} className="flex gap-2">
                <input aria-label={`${chapter.title}へ追加する話の名前`} className="field mt-0 min-w-0" maxLength={200} name="title" placeholder="新しい話" required />
                <PendingSubmitButton className="button-secondary shrink-0" pendingLabel="追加中…"><Plus className="mr-1 inline h-4 w-4" />話を追加</PendingSubmitButton>
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
                              <form action={addCloudPageToSceneAction.bind(null, projectId, scene.id)}><PendingSubmitButton className="button-secondary" pendingLabel="追加中…"><FilePlus2 className="mr-1 inline h-4 w-4" />ページ追加</PendingSubmitButton></form>
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
                                    <form action={setCloudProjectCoverAction.bind(null, projectId, page.id)}><PendingSubmitButton className="button-secondary min-h-9 px-2 py-1 text-xs" pendingLabel="設定中…">表紙</PendingSubmitButton></form>
                                    <form action={deleteCloudStructureAction.bind(null, projectId, "page", page.id)}><PendingSubmitButton aria-label={`${page.page_number}ページを削除`} className="button-secondary min-h-9 px-2 py-1 text-red-700" pendingLabel="削除中…"><Trash2 className="h-4 w-4" /></PendingSubmitButton></form>
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
                        <PendingSubmitButton className="button-secondary sm:col-span-2" pendingLabel="追加中…">追加</PendingSubmitButton>
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
