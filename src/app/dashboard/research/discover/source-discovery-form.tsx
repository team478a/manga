"use client";

import { useActionState } from "react";
import { ExternalLink, Search, ShieldCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";
import {
  discoverCloudResearchSourcesAction,
  type CloudResearchDiscoveryState,
} from "./actions";

const initialState: CloudResearchDiscoveryState = { candidates: [] };

const topicOptions = [
  ["demand", "市場需要"],
  ["competition", "競合"],
  ["audience", "読者"],
  ["theme", "人気テーマ"],
  ["price", "価格"],
  ["channel", "販売チャネル"],
  ["risk", "リスク"],
] as const;

export function SourceDiscoveryForm({
  enabled,
  verificationEnabled,
}: {
  enabled: boolean;
  verificationEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    discoverCloudResearchSourcesAction,
    initialState,
  );

  return (
    <div className="mt-6 space-y-6">
      <form action={formAction} className="panel space-y-5">
        <div>
          <label className="label" htmlFor="query">
            調べたい市場・作品条件
          </label>
          <textarea
            className="field min-h-24"
            disabled={!enabled || pending}
            id="query"
            maxLength={400}
            name="query"
            placeholder="例：日本 電子コミック 女性向け ファンタジー 市場動向"
            required
          />
          <p className="mt-2 text-xs text-stone-500">
            検索語は画面URLへ含めず、Serverから検索Providerへ送信します。
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="topic">
              根拠を探す分野
            </label>
            <select
              className="field"
              disabled={!enabled || pending}
              id="topic"
              name="topic"
              defaultValue="demand"
            >
              {topicOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="freshness">
              情報の鮮度
            </label>
            <select
              className="field"
              disabled={!enabled || pending}
              id="freshness"
              name="freshness"
              defaultValue="year"
            >
              <option value="all">全期間</option>
              <option value="month">31日以内</option>
              <option value="year">365日以内</option>
            </select>
          </div>
        </div>
        <button
          className="button inline-flex w-full items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!enabled || pending}
          type="submit"
        >
          <Search className="h-4 w-4" />
          {pending ? "検索中…" : "出典候補を検索"}
        </button>
      </form>

      {!enabled ? (
        <p className="rounded-lg bg-amber-50 p-4 text-amber-950" role="status">
          出典候補検索は現在停止中です。Feature Flagと検索Providerの設定が必要です。
        </p>
      ) : null}
      {state.error ? (
        <p className="rounded-lg bg-red-50 p-4 text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.searchedAt ? (
        <section aria-live="polite">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">検索結果</h2>
              <p className="mt-1 text-sm text-stone-600">
                {state.candidates.length}件／
                {new Date(state.searchedAt).toLocaleString("ja-JP")}
              </p>
            </div>
            <p className="text-xs text-stone-500">
              Provider: {state.provider}
            </p>
          </div>
          {state.candidates.length ? (
            <div className="mt-4 space-y-4">
              {state.candidates.map((candidate) => {
                const canAdopt =
                  !verificationEnabled || candidate.verificationEligible;
                const params = new URLSearchParams({
                  candidateTitle: candidate.title,
                  candidateUrl: candidate.url,
                  candidateTopic: state.topic ?? "demand",
                });
                if (candidate.publishedAt)
                  params.set("candidatePublishedAt", candidate.publishedAt);
                return (
                  <article className="panel" key={candidate.url}>
                    <div className="flex items-start gap-3">
                      {candidate.verificationEligible ? (
                        <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-green-700" />
                      ) : (
                        <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-amber-700" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold">{candidate.title}</h3>
                        <p className="mt-1 break-all text-xs text-stone-500">
                          {candidate.url}
                        </p>
                        {candidate.description ? (
                          <p className="mt-3 rounded-md bg-stone-50 p-3 text-sm text-stone-700">
                            検索snippet（未確認）: {candidate.description}
                          </p>
                        ) : null}
                        <p
                          className={`mt-3 text-xs ${
                            candidate.verificationEligible
                              ? "text-green-800"
                              : "text-amber-800"
                          }`}
                        >
                          {candidate.verificationEligible
                            ? "Server取得検証allowlistに適合"
                            : "Server取得検証allowlist外。検証を有効にしている場合は採用できません。"}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <a
                            className="button-secondary inline-flex items-center gap-2"
                            href={candidate.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            原文を確認
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          {canAdopt ? (
                            <Link
                              className="button bg-violet-700 hover:bg-violet-800"
                              href={`/dashboard/research/new?${params.toString()}`}
                            >
                              この候補を採用
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="panel mt-4 text-center text-stone-600">
              条件に合うWeb検索結果はありませんでした。
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
