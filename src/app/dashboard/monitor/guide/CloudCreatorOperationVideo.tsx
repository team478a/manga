"use client";

import Image from "next/image";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";

const FRAME_DURATION_MS = 7_000;

const frames = [
  {
    title: "作品画面で完成までの現在地を確認",
    description: "原稿チェックの残数を確認し、画像生成前の設定から始めます。",
    image: "/manual/cloud/03-creator-project.svg",
    alt: "原稿編集の作品画面で完成ガイドと原稿チェックを確認する画面例",
    focus: { x: 25, y: 36 },
  },
  {
    title: "人物・衣装と作品の画風を固定",
    description:
      "ページをまたいで変えたくない外見、衣装、場所、小物を先に保存します。",
    image: "/manual/cloud/03-creator-project.svg",
    alt: "原稿編集の作品画面で外見、衣装、画風、場所、小物を設定する画面例",
    focus: { x: 32, y: 72 },
  },
  {
    title: "参照画像を登録してコマへ割り当て",
    description: "登場人物・場所・小物の見本を、必要なコマへ割り当てます。",
    image: "/manual/cloud/03-creator-project.svg",
    alt: "原稿編集の作品画面で参照画像とコマ割当を開く画面例",
    focus: { x: 79, y: 72 },
  },
  {
    title: "最初は連続する2ページだけを選択",
    description: "少ない範囲で人物と画風を確認してから、次のページへ広げます。",
    image: "/manual/cloud/04-generation-preflight.svg",
    alt: "画像生成するページを選び、連続2ページの見積りを確認する画面例",
    focus: { x: 20, y: 28 },
  },
  {
    title: "必要creditと停止理由を確認して開始",
    description:
      "利用枠、人物・画風の準備、停止理由の4点を確認し、開始ボタンは1回だけ押します。",
    image: "/manual/cloud/04-generation-preflight.svg",
    alt: "ページ一括生成の必要credit、利用枠、準備状況、停止理由を確認する画面例",
    focus: { x: 57, y: 61 },
  },
  {
    title: "生成候補を拡大して比較・採用",
    description:
      "顔、手、衣装、背景、疑似文字を確認し、使用する候補だけをコマへ配置します。",
    image: "/manual/cloud/06-candidate-review.svg",
    alt: "原稿編集で生成候補を比較し、品質を確認してコマへ採用する画面例",
    focus: { x: 84, y: 77 },
  },
  {
    title: "吹き出しと文字を画像とは別に調整",
    description:
      "セリフ修正では画像を作り直さず、吹き出し・文字の位置や大きさを整えます。",
    image: "/manual/cloud/07-dialogue-edit.svg",
    alt: "原稿編集で吹き出しと縦書き文字を選択して調整する画面例",
    focus: { x: 53, y: 50 },
  },
  {
    title: "全ページを確定してPDFを保存",
    description:
      "原稿チェックを解消し、全ページ確定、完成版固定、PDF書き出しの順に進みます。",
    image: "/manual/cloud/05-export.svg",
    alt: "全ページ確定、完成版固定、PDF書き出し、ダウンロードの順番を示す画面例",
    focus: { x: 65, y: 54 },
  },
] as const;

export function CloudCreatorOperationVideo() {
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frame = frames[frameIndex];
  const atEnd = frameIndex === frames.length - 1;

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      setPlaying(!reducedMotion);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (atEnd) {
        setPlaying(false);
        return;
      }
      setFrameIndex((current) => current + 1);
    }, FRAME_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [atEnd, frameIndex, playing]);

  const play = () => {
    if (atEnd) setFrameIndex(0);
    setPlaying(true);
  };

  const move = (next: number) => {
    setPlaying(false);
    setFrameIndex(Math.min(frames.length - 1, Math.max(0, next)));
  };

  return (
    <div className="panel mt-5 overflow-hidden border-violet-200 p-0">
      <div className="relative aspect-video overflow-hidden bg-stone-950">
        <Image
          alt={frame.alt}
          className="object-contain"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 960px"
          src={frame.image}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-violet-700 bg-white/70 shadow-[0_0_0_8px_rgba(124,58,237,0.18)]"
          style={{ left: `${frame.focus.x}%`, top: `${frame.focus.y}%` }}
        >
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700" />
        </span>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/95 via-stone-950/80 to-transparent px-4 pb-4 pt-16 text-white sm:px-6 sm:pb-6">
          <p className="text-xs font-bold text-violet-200">
            操作 {frameIndex + 1} / {frames.length}
          </p>
          <h3 className="mt-1 text-lg font-bold sm:text-xl">{frame.title}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-stone-100 sm:text-base">
            {frame.description}
          </p>
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div
          aria-label={`操作デモの進行状況 ${frameIndex + 1}/${frames.length}`}
          aria-valuemax={frames.length}
          aria-valuemin={1}
          aria-valuenow={frameIndex + 1}
          className="h-2 overflow-hidden rounded-full bg-violet-100"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-violet-600 transition-[width] duration-300"
            style={{ width: `${((frameIndex + 1) / frames.length) * 100}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              aria-label="前の操作"
              className="button-secondary"
              disabled={frameIndex === 0}
              onClick={() => move(frameIndex - 1)}
              type="button"
            >
              <SkipBack className="h-4 w-4" />
              前へ
            </button>
            {playing ? (
              <button
                className="button"
                onClick={() => setPlaying(false)}
                type="button"
              >
                <Pause className="h-4 w-4" />
                一時停止
              </button>
            ) : (
              <button className="button" onClick={play} type="button">
                {atEnd ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {atEnd ? "最初から見る" : "再生"}
              </button>
            )}
            <button
              aria-label="次の操作"
              className="button-secondary"
              disabled={atEnd}
              onClick={() => move(frameIndex + 1)}
              type="button"
            >
              次へ
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-stone-600">約1分・音声なし・字幕付き</p>
        </div>
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {frames.map((item, index) => (
            <li key={item.title}>
              <button
                aria-current={index === frameIndex ? "step" : undefined}
                aria-label={`操作${index + 1}：${item.title}`}
                className={`min-h-10 w-full rounded-lg border px-2 py-1 text-xs font-bold transition ${
                  index === frameIndex
                    ? "border-violet-600 bg-violet-600 text-white"
                    : "border-violet-200 bg-white text-violet-800 hover:bg-violet-50"
                }`}
                onClick={() => move(index)}
                type="button"
              >
                {index + 1}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
