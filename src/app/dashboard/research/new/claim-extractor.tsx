"use client";

import { useActionState } from "react";
import { ExternalLink, FileSearch } from "lucide-react";
import {
  extractCloudResearchClaimsAction,
  type CloudResearchClaimExtractionState,
} from "./claim-actions";

const initialState: CloudResearchClaimExtractionState = { candidates: [] };

const topicLabels: Record<string, string> = {
  demand: "市場需要",
  competition: "競合",
  audience: "読者",
  theme: "人気テーマ",
  price: "価格",
  channel: "販売チャネル",
  risk: "リスク",
};

export function ClaimExtractor({
  url,
  topic,
  enabled,
}: {
  url: string;
  topic: string;
  enabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    extractCloudResearchClaimsAction,
    initialState,
  );

  const adopt = (text: string) => {
    const field = document.getElementById("sourceFact0");
    if (!(field instanceof HTMLTextAreaElement)) return;
    field.value = text;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
  };

  return (
    <section className="panel mt-6" aria-labelledby="claim-extractor-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold" id="claim-extractor-title">
            検証済み本文から事実候補を抽出
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            {topicLabels[topic] ?? topic}に関係する原文だけを候補化します。候補は事実の確定ではありません。
          </p>
        </div>
        <a
          className="button-secondary inline-flex shrink-0 items-center gap-2"
          href={url}
          rel="noreferrer"
          target="_blank"
        >
          原文を開く
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <form action={formAction} className="mt-4">
        <input name="url" type="hidden" value={url} />
        <input name="topic" type="hidden" value={topic} />
        <button
          className="button inline-flex w-full items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!enabled || pending}
          type="submit"
        >
          <FileSearch className="h-4 w-4" />
          {pending ? "本文を検証・抽出中…" : "事実候補を抽出"}
        </button>
      </form>
      {!enabled ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          Server出典検証が停止中のため抽出できません。
        </p>
      ) : null}
      {state.error ? (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.extractedAt ? (
        <div className="mt-5" aria-live="polite">
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            候補です。採用前に必ず原文と照合してください。採用後も市場分析の保存操作が必要です。
          </p>
          <p className="mt-2 break-all text-xs text-stone-500">
            取得: {new Date(state.extractedAt).toLocaleString("ja-JP")}
            {state.textTruncated ? "／本文上限までを抽出" : ""}
            {state.textSha256 ? `／本文hash: ${state.textSha256.slice(0, 12)}…` : ""}
          </p>
          {state.candidates.length ? (
            <ol className="mt-4 space-y-3">
              {state.candidates.map((candidate) => (
                <li className="rounded-lg border border-stone-200 p-4" key={candidate.id}>
                  <p className="whitespace-pre-wrap text-sm leading-7">
                    {candidate.text}
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-stone-500">
                      原文位置 {candidate.textStart}–{candidate.textEnd}
                      ／一致語: {candidate.signals.join("、")}
                    </p>
                    <button
                      className="button-secondary shrink-0"
                      onClick={() => adopt(candidate.text)}
                      type="button"
                    >
                      事実メモへ採用
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-stone-600">
              選択分野に合う事実候補は見つかりませんでした。原文を確認して手動入力してください。
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
