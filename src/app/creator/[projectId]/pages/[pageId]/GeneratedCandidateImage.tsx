"use client";
/* eslint-disable @next/next/no-img-element -- Private signed candidate URLs. */

import { useEffect, useRef, useState } from "react";
import { candidateDisplayCanBeRecorded } from "@/modules/manga/domain/generation-refresh-policy";

export function GeneratedCandidateImage({ url, jobId, recordDisplay, onDisplayed }: {
  url: string;
  jobId: string;
  recordDisplay: boolean;
  onDisplayed(jobId: string): void;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  useEffect(() => {
    const element = image.current;
    if (!recordDisplay || !element || loadedUrl !== url || typeof IntersectionObserver === "undefined") return;
    let intersecting = false;
    let active = true;
    const notify = () => {
      if (active && candidateDisplayCanBeRecorded({
        loaded: element.complete, naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight,
        intersecting, documentVisible: document.visibilityState === "visible",
      })) onDisplayed(jobId);
    };
    const observer = new IntersectionObserver(entries => {
      intersecting = entries.some(entry => entry.target === element && entry.isIntersecting && entry.intersectionRatio > 0);
      notify();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", notify);
    return () => {
      active = false;
      observer.disconnect();
      document.removeEventListener("visibilitychange", notify);
    };
  }, [jobId, loadedUrl, onDisplayed, recordDisplay, url]);
  return <img ref={image} alt="生成されたコマ候補"
    className="mt-2 aspect-video w-full rounded border border-stone-200 object-cover"
    src={url} onLoad={event => {
      if (event.currentTarget.currentSrc === new URL(url, document.baseURI).href) setLoadedUrl(url);
    }} onError={() => setLoadedUrl(null)} />;
}
