"use client";

import { Download, ListVideo, PlayCircle } from "lucide-react";
import { useRef } from "react";

const VIDEO_PATH = "/manual/cloud/cloud-creator-operation-guide.mp4";

const chapters = [
  { time: 5, label: "作品画面で現在地を確認" },
  { time: 12, label: "人物・衣装と作品の画風を固定" },
  { time: 20, label: "参照画像を登録してコマへ割り当て" },
  { time: 27, label: "最初は連続する2ページだけを選択" },
  { time: 35, label: "必要creditと停止理由を確認" },
  { time: 43, label: "生成候補を拡大して比較・採用" },
  { time: 51, label: "吹き出しと文字を画像とは別に調整" },
  { time: 59, label: "全ページを確定してPDFを保存" },
] as const;

const transcript = [
  "作品画面で原稿チェックの残数を確認し、画像生成前の設定から始めます。",
  "ページをまたいで変えたくない人物の外見・衣装、作品の画風、場所・小物を先に保存します。",
  "人物・場所・小物の参照画像を登録し、必要なコマへ割り当てます。",
  "最初は連続する2ページだけを選び、人物と画風を確認してから範囲を広げます。",
  "必要credit、残り利用枠、最大予約費用、停止理由を確認し、開始ボタンは1回だけ押します。",
  "生成候補の顔、手、衣装、背景、疑似文字を確認し、使う候補だけをコマへ配置します。",
  "セリフ修正では画像を作り直さず、吹き出しと文字の位置・大きさ・縦書きを調整します。",
  "原稿チェックを解消し、全ページ確定、完成版固定、PDF書き出しの順に進みます。",
] as const;

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function CloudCreatorOperationVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const jumpTo = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    void video.play().catch(() => undefined);
  };

  return (
    <div className="panel mt-5 overflow-hidden border-violet-200 p-0">
      <div className="bg-stone-950">
        <video
          aria-label="原稿編集からPDF完成までの動画マニュアル"
          className="aspect-video h-auto w-full"
          controls
          playsInline
          poster="/manual/cloud/cloud-creator-operation-guide-poster.webp"
          preload="metadata"
          ref={videoRef}
        >
          <source src={VIDEO_PATH} type="video/mp4" />
          <track
            default
            kind="captions"
            label="日本語字幕"
            src="/manual/cloud/cloud-creator-operation-guide.vtt"
            srcLang="ja"
          />
          お使いのブラウザでは動画を再生できません。下の文字版手順をご利用ください。
        </video>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-2 font-bold text-stone-900">
              <PlayCircle
                className="h-5 w-5 text-violet-700"
                aria-hidden="true"
              />
              約1分15秒・音声なし・日本語字幕付き
            </p>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              再生速度、全画面、字幕は動画プレイヤーから変更できます。
            </p>
          </div>
          <a
            className="button-secondary shrink-0"
            download="MANGAI-Cloud-原稿編集からPDF完成まで.mp4"
            href={VIDEO_PATH}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            動画を保存
          </a>
        </div>

        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-violet-800">
            <ListVideo className="h-4 w-4" aria-hidden="true" />
            見たい操作へ移動
          </p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {chapters.map((chapter, index) => (
              <li key={chapter.label}>
                <button
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-violet-200 bg-white px-3 py-2 text-left text-sm font-bold text-stone-800 transition hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
                  onClick={() => jumpTo(chapter.time)}
                  type="button"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">{chapter.label}</span>
                  <span className="shrink-0 font-normal text-stone-500">
                    {formatTime(chapter.time)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <details className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <summary className="cursor-pointer font-bold text-stone-900">
            動画の内容を文字で読む
          </summary>
          <ol className="mt-4 space-y-3 text-sm leading-relaxed text-stone-700">
            {transcript.map((item, index) => (
              <li className="flex gap-3" key={item}>
                <span className="font-bold text-violet-700">{index + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </details>
      </div>
    </div>
  );
}
