"use client";

import { useState } from "react";
import {
  createCompletionModeProfile,
  type CompletionMode,
} from "@mangai/shared";

const OPTIONS: Array<{ mode: CompletionMode; label: string; description: string }> = [
  { mode: "longform_story", label: "長編ストーリー漫画", description: "標準の縦長原稿。長編制作と幅広い書き出し向けです。" },
  { mode: "kindle_explainer", label: "Kindle向け解説漫画", description: "高解像度の縦長原稿。Kindle Createへ渡す素材向けです。" },
];

export function CompletionModeFields() {
  const [mode, setMode] = useState<CompletionMode>("longform_story");
  const profile = createCompletionModeProfile(mode, "cloud_general");
  const selected = OPTIONS.find((option) => option.mode === mode)!;
  return (
    <fieldset className="space-y-3">
      <legend className="label">完成モード</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <label key={option.mode} className="rounded-lg border border-stone-300 p-4">
            <span className="flex items-start gap-3">
              <input type="radio" name="completionMode" value={option.mode} checked={mode === option.mode} onChange={() => setMode(option.mode)} />
              <span><strong className="block">{option.label}</strong><span className="mt-1 block text-sm text-stone-600">{option.description}</span></span>
            </span>
          </label>
        ))}
      </div>
      <div className="rounded-lg bg-stone-50 p-4 text-sm" aria-live="polite">
        <strong>{selected.label}のpreset</strong>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          <div><dt className="text-stone-500">原稿</dt><dd>{profile.pagePreset.width} × {profile.pagePreset.height}px</dd></div>
          <div><dt className="text-stone-500">解像度</dt><dd>{profile.pagePreset.dpi} DPI</dd></div>
          <div><dt className="text-stone-500">推奨コマ数</dt><dd>{profile.guidance.panelsPerPage.min}〜{profile.guidance.panelsPerPage.max}</dd></div>
          <div><dt className="text-stone-500">セリフ目安</dt><dd>1コマ {profile.guidance.maxDialogueGraphemesPerPanel}文字まで</dd></div>
        </dl>
      </div>
      <input type="hidden" name="width" value={profile.pagePreset.width} />
      <input type="hidden" name="height" value={profile.pagePreset.height} />
      <input type="hidden" name="dpi" value={profile.pagePreset.dpi} />
      <input type="hidden" name="readingDirection" value={profile.pagePreset.readingDirection} />
    </fieldset>
  );
}
