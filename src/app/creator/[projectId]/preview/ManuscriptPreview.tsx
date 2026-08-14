"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { CloudPageCompletion } from "@/modules/cloud-creator/projects/page-completion-service";

export function ManuscriptPreview({ projectId, pages }: { projectId: string; pages: CloudPageCompletion[] }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const page = pages[index];
  const imageUrl = useMemo(
    () => page ? `/api/creator/projects/${projectId}/pages/${page.pageId}/preview?revision=${page.savedRevision ?? 0}&retry=${retry}` : "",
    [page, projectId, retry],
  );
  const move = useCallback((value: number) => {
    setFailed(false);
    setIndex((current) => Math.max(0, Math.min(pages.length - 1, current + value)));
  }, [pages.length]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  if (!page) return <p className="rounded-lg bg-amber-50 p-4 text-amber-900">表示できる本文ページがありません。</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <button aria-label="前のページ" className="button-secondary" disabled={index === 0} onClick={() => move(-1)} type="button"><ChevronLeft className="h-4 w-4" />前ページ</button>
          <strong aria-live="polite">{page.pageNumber} / {pages.length}ページ</strong>
          <button aria-label="次のページ" className="button-secondary" disabled={index === pages.length - 1} onClick={() => move(1)} type="button">次ページ<ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button aria-label="縮小" className="button-secondary" disabled={zoom <= 50} onClick={() => setZoom((value) => Math.max(50, value - 25))} type="button"><ZoomOut className="h-4 w-4" /></button>
          <span className="min-w-14 text-center text-sm">{zoom}%</span>
          <button aria-label="拡大" className="button-secondary" disabled={zoom >= 200} onClick={() => setZoom((value) => Math.min(200, value + 25))} type="button"><ZoomIn className="h-4 w-4" /></button>
          <button className="button-secondary" onClick={() => setZoom(100)} type="button">幅に合わせる</button>
          <a className="button-secondary" download href={`${imageUrl}&download=1`}><Download className="h-4 w-4" />PNG</a>
        </div>
      </div>
      {page.status !== "complete" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
          <strong>このページは{page.status === "generating" ? "生成中" : page.status === "review_required" ? "確認待ち" : "未完成"}です。</strong>
          <ul className="mt-2 list-disc pl-5">{page.blockers.map((blocker, blockerIndex) => <li key={`${blocker.code}-${blocker.panelId ?? blockerIndex}`}>{blocker.message}</li>)}</ul>
        </div>
      ) : null}
      <div className="overflow-auto rounded-xl bg-stone-200 p-2 sm:p-4" tabIndex={0} aria-label={`${page.pageNumber}ページ原稿`}>
        {failed ? (
          <div className="grid min-h-80 place-items-center bg-white p-6 text-center"><div><p>ページ画像を読み込めませんでした。</p><button className="button mt-4" onClick={() => { setFailed(false); setRetry((value) => value + 1); }} type="button"><RotateCcw className="h-4 w-4" />再試行</button></div></div>
        ) : (
          // Page height is never cropped; the scroll container handles zoom above fit width.
          <Image alt={`${page.pageNumber}ページの漫画原稿`} className="mx-auto h-auto max-w-none bg-white object-contain shadow-xl" height={page.height} onError={() => setFailed(true)} priority unoptimized src={imageUrl} style={{ width: `${zoom}%` }} width={page.width} />
        )}
      </div>
      <nav aria-label="ページ一覧" className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {pages.map((item, pageIndex) => <button aria-current={pageIndex === index ? "page" : undefined} className={`min-h-11 rounded-lg border px-2 py-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-700 ${pageIndex === index ? "border-violet-700 bg-violet-50 text-violet-900" : "border-stone-200 bg-white"}`} key={item.pageId} onClick={() => { setFailed(false); setIndex(pageIndex); }} type="button">{item.pageNumber}P<span className="block text-xs font-normal">{item.status === "complete" ? "完成" : "未完成"}</span></button>)}
      </nav>
    </div>
  );
}
