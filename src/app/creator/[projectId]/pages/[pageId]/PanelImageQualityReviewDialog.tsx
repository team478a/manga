"use client";
/* eslint-disable @next/next/no-img-element -- Review uses a private signed asset URL. */

import { useState } from "react";

const reviewItems = [
  {
    id: "orientation",
    label:
      "天地と重力が自然で、意図のない上下反転・横倒しになっていない",
  },
  {
    id: "lettering",
    label:
      "画像の中に疑似文字・読めない文字・吹き出し・ロゴが描き込まれていない",
  },
  {
    id: "anatomy",
    label:
      "顔・口元・手指・関節・小物の接触に販売原稿として目立つ破綻がない",
  },
  {
    id: "story",
    label:
      "登場人物・表情・構図・背景がネームの一つの場面として成立している",
  },
] as const;

export function PanelImageQualityReviewDialog({
  imageUrl,
  onCancel,
  onConfirm,
}: {
  imageUrl: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const allConfirmed = reviewItems.every((item) => confirmed[item.id]);

  return (
    <div
      aria-labelledby="panel-image-quality-review-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
      role="dialog"
    >
      <div className="max-h-full w-full max-w-4xl overflow-auto rounded-xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold" id="panel-image-quality-review-title">
              原稿画像の必須品質確認
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              拡大して確認し、4項目をすべて満たす画像だけを採用してください。
            </p>
          </div>
          <button className="button-secondary" onClick={onCancel} type="button">
            閉じる
          </button>
        </div>

        <div className="mt-4 flex max-h-[55vh] justify-center overflow-auto rounded-lg bg-stone-900 p-2">
          <img
            alt="品質確認する生成画像"
            className="max-h-[52vh] max-w-full object-contain"
            src={imageUrl}
          />
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="font-bold">販売原稿チェック</legend>
          {reviewItems.map((item) => (
            <label
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3 text-sm"
              key={item.id}
            >
              <input
                checked={Boolean(confirmed[item.id])}
                className="mt-0.5 h-5 w-5 accent-violet-700"
                onChange={(event) =>
                  setConfirmed((current) => ({
                    ...current,
                    [item.id]: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </fieldset>

        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          1項目でも満たさない場合は採用せず、候補一覧から不採用または作り直しを選んでください。
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="button-secondary" onClick={onCancel} type="button">
            候補一覧へ戻る
          </button>
          <button
            className="button"
            disabled={!allConfirmed}
            onClick={onConfirm}
            type="button"
          >
            4項目を確認して採用
          </button>
        </div>
      </div>
    </div>
  );
}
