"use client";

import { useActionState } from "react";
import { ExternalLink, GitCompareArrows } from "lucide-react";
import {
  compareCloudResearchClaimsAction,
  type CloudResearchCorroborationState,
} from "./corroboration-actions";

const initialState: CloudResearchCorroborationState = {};

const relationPresentation = {
  corroborates: {
    label: "定量根拠が一致",
    className: "bg-green-50 text-green-900",
  },
  potential_conflict: {
    label: "相反の可能性",
    className: "bg-red-50 text-red-800",
  },
  related: {
    label: "関連・比較不能",
    className: "bg-amber-50 text-amber-950",
  },
  insufficient: {
    label: "根拠不足",
    className: "bg-stone-100 text-stone-700",
  },
} as const;

function setFieldValue(id: string, value: string) {
  const field = document.getElementById(id);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement))
    return;
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

export function ClaimComparison({
  primaryUrl,
  topic,
  enabled,
}: {
  primaryUrl: string;
  topic: string;
  enabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    compareCloudResearchClaimsAction,
    initialState,
  );

  const adoptPair = (
    primaryText: string,
    comparisonText: string,
  ) => {
    if (!state.result) return;
    const comparisonSource = state.result.comparisonSource.verification;
    setFieldValue("sourceFact0", primaryText);
    setFieldValue(
      "sourceTitle1",
      comparisonSource.documentTitle ??
        new URL(comparisonSource.finalUrl).hostname,
    );
    setFieldValue("sourceUrl1", comparisonSource.finalUrl);
    setFieldValue(
      "sourceRetrievedAt1",
      comparisonSource.checkedAt.slice(0, 16),
    );
    setFieldValue("sourceFact1", comparisonText);
    const topicField = document.querySelector<HTMLInputElement>(
      `input[name="sourceTopics1"][value="${topic}"]`,
    );
    if (topicField) {
      topicField.checked = true;
      topicField.dispatchEvent(new Event("change", { bubbles: true }));
    }
    document.getElementById("sourceFact1")?.focus();
  };

  return (
    <section className="panel mt-6" aria-labelledby="claim-comparison-title">
      <h2 className="text-xl font-bold" id="claim-comparison-title">
        2つの出典を照合
      </h2>
      <p className="mt-2 text-sm text-stone-600">
        同じ分野の原文候補を比較します。相反表示は誤りの断定ではなく、指標・時点・母集団を確認するための警告です。
      </p>
      <form action={formAction} className="mt-4 space-y-4">
        <input name="primaryUrl" type="hidden" value={primaryUrl} />
        <input name="topic" type="hidden" value={topic} />
        <div>
          <label className="label" htmlFor="comparisonUrl">
            比較する出典URL（HTTPS）
          </label>
          <input
            className="field"
            disabled={!enabled || pending}
            id="comparisonUrl"
            name="comparisonUrl"
            placeholder="https://..."
            required
            type="url"
          />
        </div>
        <button
          className="button inline-flex w-full items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!enabled || pending}
          type="submit"
        >
          <GitCompareArrows className="h-4 w-4" />
          {pending ? "2つの本文を検証・照合中…" : "出典を照合"}
        </button>
      </form>
      {state.error ? (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.result ? (
        <div className="mt-5" aria-live="polite">
          {!state.result.independentDomains ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              2つの出典は同一domainです。独立した裏付けとして扱う前に情報源を確認してください。
            </p>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              state.result.primarySource.verification,
              state.result.comparisonSource.verification,
            ].map((source, index) => (
              <a
                className="rounded-lg border border-stone-200 p-3 text-sm hover:border-violet-300"
                href={source.finalUrl}
                key={source.sha256}
                rel="noreferrer"
                target="_blank"
              >
                <span className="font-bold">
                  出典{index + 1}: {source.documentTitle ?? new URL(source.finalUrl).hostname}
                </span>
                <span className="mt-1 flex items-center gap-1 break-all text-xs text-stone-500">
                  {source.finalUrl}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </span>
              </a>
            ))}
          </div>
          {state.result.comparisons.length ? (
            <ol className="mt-4 space-y-4">
              {state.result.comparisons.map((comparison) => {
                const presentation =
                  relationPresentation[comparison.relation];
                return (
                  <li
                    className="rounded-lg border border-stone-200 p-4"
                    key={comparison.id}
                  >
                    <p
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${presentation.className}`}
                    >
                      {presentation.label}
                    </p>
                    <p className="mt-3 text-sm font-medium">
                      {comparison.reason}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <blockquote className="rounded-lg bg-stone-50 p-3 text-sm leading-6">
                        <span className="mb-2 block text-xs font-bold text-stone-500">
                          出典1
                        </span>
                        {comparison.primary.text}
                      </blockquote>
                      <blockquote className="rounded-lg bg-stone-50 p-3 text-sm leading-6">
                        <span className="mb-2 block text-xs font-bold text-stone-500">
                          出典2
                        </span>
                        {comparison.comparison.text}
                      </blockquote>
                    </div>
                    <p className="mt-3 text-xs text-stone-500">
                      共通指標: {comparison.sharedMetrics.join("、") || "なし"}
                      ／共通年: {comparison.sharedYears.join("、") || "未確認"}
                      ／信頼度: {comparison.confidence === "medium" ? "中" : "低"}
                    </p>
                    <button
                      className="button-secondary mt-4 w-full"
                      onClick={() =>
                        adoptPair(
                          comparison.primary.text,
                          comparison.comparison.text,
                        )
                      }
                      type="button"
                    >
                      両方を出典1・2へ採用
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-4 rounded-lg bg-stone-50 p-4 text-sm text-stone-700">
              比較可能な候補はありませんでした。指標・単位・時点を原文で確認し、必要なら手動入力してください。
            </p>
          )}
          <p className="mt-4 text-xs text-stone-500">
            採用後、出典2の種別と必要に応じて公開日時を入力し、両方の原文を確認してから市場分析を保存してください。
          </p>
        </div>
      ) : null}
    </section>
  );
}
