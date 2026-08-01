"use client";
/* eslint-disable @next/next/no-img-element -- Comparison uses private signed asset URLs. */

import { useState } from "react";
import {
  resolveComparisonSourceFrame,
  type ComparisonDirection,
} from "./services/panel-image-comparison";

type ComparisonImage = {
  url: string;
  width: number;
  height: number;
};

export function PanelImageComparisonDialog({
  before,
  after,
  direction,
  onClose,
  onAdopt,
}: {
  before: ComparisonImage;
  after: ComparisonImage;
  direction: ComparisonDirection;
  onClose: () => void;
  onAdopt: () => void;
}) {
  const [position, setPosition] = useState(50);
  const sourceFrame = resolveComparisonSourceFrame({
    beforeWidth: before.width,
    beforeHeight: before.height,
    afterWidth: after.width,
    afterHeight: after.height,
    direction,
  });

  return (
    <div
      aria-labelledby="panel-comparison-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
      role="dialog"
    >
      <div className="max-h-full w-full max-w-5xl overflow-auto rounded-xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold" id="panel-comparison-title">
              修正前と候補を比較
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              スライダーを動かして、変更された範囲を確認してください。
            </p>
          </div>
          <button className="button-secondary" onClick={onClose} type="button">
            閉じる
          </button>
        </div>

        <div
          className="relative mt-4 w-full overflow-hidden rounded-lg bg-stone-900"
          style={{ aspectRatio: `${after.width} / ${after.height}` }}
        >
          <img
            alt="生成された修正候補"
            className="absolute inset-0 h-full w-full"
            src={after.url}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
            <img
              alt=""
              className="absolute max-w-none"
              src={before.url}
              style={{
                left: `${sourceFrame.left}%`,
                top: `${sourceFrame.top}%`,
                width: `${sourceFrame.width}%`,
                height: `${sourceFrame.height}%`,
              }}
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
            style={{ left: `${position}%` }}
          />
          <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs font-bold text-white">
            修正前
          </span>
          <span className="absolute right-2 top-2 rounded bg-violet-700/90 px-2 py-1 text-xs font-bold text-white">
            生成候補
          </span>
        </div>

        <label className="mt-4 block text-sm font-semibold" htmlFor="panel-comparison-position">
          比較位置: {position}%
        </label>
        <input
          aria-label="修正前と生成候補の比較位置"
          className="mt-2 min-h-11 w-full accent-violet-700"
          id="panel-comparison-position"
          max="100"
          min="0"
          onChange={(event) => setPosition(Number(event.target.value))}
          type="range"
          value={position}
        />
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="button-secondary" onClick={onClose} type="button">
            候補一覧へ戻る
          </button>
          <button className="button" onClick={onAdopt} type="button">
            この候補を採用
          </button>
        </div>
      </div>
    </div>
  );
}
