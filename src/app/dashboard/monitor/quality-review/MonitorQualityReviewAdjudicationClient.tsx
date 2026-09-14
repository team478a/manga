"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MONITOR_QUALITY_REVIEW_LABELS,
  type MonitorQualityReviewDraft,
} from "@/modules/manga-quality/domain/monitor-quality-review";
import type { MonitorQualityReviewAdjudicationDifference } from
  "@/modules/manga-quality/domain/monitor-quality-review-adjudication";
import type {
  MonitorQualityReviewAdjudicationWorkspace,
  MonitorQualityReviewCase,
} from "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";

type Draft = {
  verdict: "good" | "borderline" | "bad" | null;
  confidence: number | null;
  defects: Array<{
    category: string;
    severity: "minor" | "major" | "critical";
    comment: string;
  }>;
  overallComment: string;
};

const emptyDraft = (): Draft => ({
  verdict: null,
  confidence: null,
  defects: [],
  overallComment: "",
});

const verdictLabel = {
  good: "良好",
  borderline: "判断が難しい",
  bad: "問題あり",
} as const;

const severityLabel = {
  minor: "軽微",
  major: "明確",
  critical: "重大",
} as const;

function toDraft(value: MonitorQualityReviewDraft | null): Draft {
  return value ? {
    verdict: value.verdict,
    confidence: value.confidence,
    defects: value.defects,
    overallComment: value.overallComment,
  } : emptyDraft();
}

function makeKey() {
  return `adjudication-${crypto.randomUUID()}`;
}

function ReviewFields(props: {
  draft: Draft;
  reviewCase: MonitorQualityReviewCase;
  disabled: boolean;
  idPrefix: string;
  onChange: (change: Partial<Draft>) => void;
}) {
  return (
    <>
      <fieldset className="mt-5" disabled={props.disabled}>
        <legend className="font-bold">総合判定</legend>
        <div className="mt-2 grid gap-2">
          {(["good", "borderline", "bad"] as const).map((value) => (
            <label className="flex items-center gap-3 rounded-lg border border-stone-200 p-3" key={value}>
              <input
                checked={props.draft.verdict === value}
                name={`${props.idPrefix}-verdict`}
                onChange={() => props.onChange({
                  verdict: value,
                  defects: value === "good" ? [] : props.draft.defects,
                })}
                type="radio"
              />
              <span className="font-semibold">{verdictLabel[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-5 block font-bold" htmlFor={`${props.idPrefix}-confidence`}>確信度</label>
      <select
        className="field mt-2 w-full"
        disabled={props.disabled}
        id={`${props.idPrefix}-confidence`}
        onChange={(event) => props.onChange({ confidence: Number(event.target.value) || null })}
        value={props.draft.confidence ?? ""}
      >
        <option value="">選択してください</option>
        {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
      </select>
      {props.draft.verdict !== "good" ? (
        <fieldset className="mt-5" disabled={props.disabled}>
          <legend className="font-bold">気になる点</legend>
          <div className="mt-2 grid gap-2">
            {props.reviewCase.allowed_defect_categories.map((category) => {
              const selected = props.draft.defects.find((item) => item.category === category);
              return (
                <div className="rounded-lg border border-stone-200 p-3" key={category}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      checked={Boolean(selected)}
                      className="mt-1"
                      onChange={(event) => props.onChange({
                        defects: event.target.checked
                          ? [...props.draft.defects, { category, severity: "major", comment: "" }]
                          : props.draft.defects.filter((item) => item.category !== category),
                      })}
                      type="checkbox"
                    />
                    <span>{MONITOR_QUALITY_REVIEW_LABELS[category as keyof typeof MONITOR_QUALITY_REVIEW_LABELS] ?? category}</span>
                  </label>
                  {selected ? (
                    <select
                      aria-label={`${category}の影響度`}
                      className="field mt-2 w-full text-sm"
                      onChange={(event) => props.onChange({
                        defects: props.draft.defects.map((item) => item.category === category
                          ? { ...item, severity: event.target.value as "minor" | "major" | "critical" }
                          : item),
                      })}
                      value={selected.severity}
                    >
                      <option value="minor">軽微</option>
                      <option value="major">明確</option>
                      <option value="critical">重大</option>
                    </select>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <label className="mt-5 block font-bold" htmlFor={`${props.idPrefix}-comment`}>コメント（任意）</label>
      <textarea
        className="field mt-2 min-h-24 w-full"
        disabled={props.disabled}
        id={`${props.idPrefix}-comment`}
        maxLength={2000}
        onChange={(event) => props.onChange({ overallComment: event.target.value })}
        value={props.draft.overallComment}
      />
    </>
  );
}

function AnonymousVote(props: {
  label: string;
  vote: MonitorQualityReviewAdjudicationDifference["reviewer_a"];
}) {
  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <h3 className="font-bold">{props.label}</h3>
      <p className="mt-2 text-sm">総合判定: <strong>{verdictLabel[props.vote.verdict]}</strong></p>
      {props.vote.defects.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
          {props.vote.defects.map((defect, index) => (
            <li key={`${defect.category}-${defect.severity}-${index}`}>
              {MONITOR_QUALITY_REVIEW_LABELS[defect.category as keyof typeof MONITOR_QUALITY_REVIEW_LABELS] ?? defect.category}
              （{severityLabel[defect.severity]}）
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-stone-600">指摘項目なし</p>}
    </div>
  );
}

export function MonitorQualityReviewAdjudicationClient(props: {
  adjudication: NonNullable<MonitorQualityReviewAdjudicationWorkspace["adjudication"]>;
  reviewCase: MonitorQualityReviewCase;
  progress: MonitorQualityReviewAdjudicationWorkspace["progress"];
}) {
  const router = useRouter();
  const [phase, setPhase] = useState(props.adjudication.status);
  const [draft, setDraft] = useState<Draft>(() => toDraft(
    props.adjudication.independentDraft ?? props.adjudication.draft,
  ));
  const [independentDraft, setIndependentDraft] = useState<Draft | null>(() =>
    props.adjudication.independentDraft ? toDraft(props.adjudication.independentDraft) : null);
  const [difference, setDifference] = useState<MonitorQualityReviewAdjudicationDifference | null>(null);
  const [differenceWasRevealed, setDifferenceWasRevealed] = useState(Boolean(props.adjudication.differences_revealed_at));
  const [lockConfirmed, setLockConfirmed] = useState(false);
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [abstainConfirmed, setAbstainConfirmed] = useState(false);
  const [decisionReason, setDecisionReason] = useState("");
  const [abstainReason, setAbstainReason] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveSequence = useRef(0);
  const imageUrl = `/api/monitor/quality-review/adjudication/image?adjudicationId=${encodeURIComponent(props.adjudication.id)}&caseId=${encodeURIComponent(props.reviewCase.id)}`;

  const post = useCallback(async (body: unknown) => {
    let lastError = "操作を完了できませんでした。";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch("/api/monitor/quality-review/adjudication", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) return data;
        lastError = typeof data.error === "string" ? data.error : lastError;
        if (response.status < 500 && response.status !== 429)
          throw Object.assign(new Error(lastError), { retryable: false });
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
        if (error && typeof error === "object" && "retryable" in error
          && error.retryable === false)
          throw new Error(lastError);
        if (attempt === 1) throw new Error(lastError);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    throw new Error(lastError);
  }, []);

  const enqueueSave = useCallback((body: unknown) => {
    const request = saveQueue.current.catch(() => undefined).then(() => post(body));
    saveQueue.current = request.then(() => undefined, () => undefined);
    return request;
  }, [post]);

  function updateDraft(change: Partial<Draft>) {
    if (phase === "submitted" || phase === "abstained") return;
    setDraft((value) => ({ ...value, ...change }));
    if (phase === "in_progress") setDirty(true);
  }

  useEffect(() => {
    if (!dirty || phase !== "in_progress") return;
    const sequence = ++saveSequence.current;
    const timer = window.setTimeout(async () => {
      const body = {
        action: "save",
        adjudicationId: props.adjudication.id,
        idempotencyKey: makeKey(),
        draft: { caseId: props.reviewCase.id, ...draft, complete: false },
      };
      try {
        setMessage("独立判定の下書きを保存中…");
        await enqueueSave(body);
        if (sequence === saveSequence.current) {
          setDirty(false);
          setMessage("独立判定の下書きを保存しました。");
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "下書きを保存できませんでした。");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [dirty, draft, enqueueSave, phase, props.adjudication.id, props.reviewCase.id]);

  async function perform(body: unknown, onSuccess: (data: Record<string, unknown>) => void) {
    setBusy(true);
    setMessage("");
    try {
      const data = await post(body);
      onSuccess(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作を完了できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "assigned") return (
    <section className="panel mt-6">
      <p className="text-sm font-bold text-amber-800">第三者裁定 1件</p>
      <h2 className="mt-2 text-xl font-bold">開始前の確認</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-stone-700">
        <li>最初に画像だけを見て、ご自身の独立判定を確定します。</li>
        <li>独立判定の確定後に限り、匿名化された2名の判定差分を確認できます。</li>
        <li>氏名、コメント、回答時刻など、回答者を特定できる情報は表示されません。</li>
        <li>画像と判定内容を保存・転載・共有しないでください。</li>
      </ul>
      <button
        className="button mt-5 w-full bg-violet-700 hover:bg-violet-800 sm:w-auto"
        disabled={busy}
        onClick={() => perform({
          action: "consent",
          adjudicationId: props.adjudication.id,
          idempotencyKey: makeKey(),
        }, () => {
          setPhase("in_progress");
          setMessage("独立判定を開始できます。");
        })}
        type="button"
      >内容を確認して裁定を開始</button>
      {message ? <p className="mt-4 text-sm" role="status">{message}</p> : null}
    </section>
  );

  if (phase === "submitted" || phase === "abstained") return (
    <section className="panel mt-6">
      <h2 className="text-xl font-bold">{phase === "submitted" ? "裁定を送信しました" : "裁定を辞退しました"}</h2>
      <p className="mt-3 text-stone-700">元の回答や画像は変更されていません。記録は管理者が確認します。</p>
      <button className="button-secondary mt-5" onClick={() => router.refresh()} type="button">次の割り当てを確認</button>
    </section>
  );

  const independentLocked = phase === "independent_locked";
  return (
    <div className="mt-6">
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-amber-800">第三者裁定</p>
            <h2 className="mt-1 text-xl font-bold">対象画像 1件</h2>
          </div>
          <p className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold">
            残り {props.progress.pending} / 全{props.progress.total}件
          </p>
        </div>
        <button
          aria-label="画像を拡大表示"
          className="mt-4 flex w-full justify-center rounded-xl bg-stone-100 p-2"
          onClick={() => setImageOpen(true)}
          type="button"
        >
          <Image alt="第三者裁定の対象画像" className="h-auto max-h-[70vh] w-auto rounded-lg object-contain" height={1024} priority width={704} src={imageUrl} unoptimized />
        </button>
        <p className="mt-2 text-center text-xs text-stone-500">画像をタップすると拡大できます。</p>
      </section>

      {imageOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3" role="dialog">
          <button aria-label="拡大表示を閉じる" className="absolute right-4 top-4 rounded bg-white px-4 py-2 font-bold" onClick={() => setImageOpen(false)} type="button">閉じる</button>
          <Image alt="第三者裁定の対象画像（拡大）" className="max-h-[92vh] w-auto object-contain" height={1600} width={1100} src={imageUrl} unoptimized />
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="panel h-fit">
          <h2 className="text-lg font-bold">1. ご自身の独立判定</h2>
          <p className="mt-2 text-sm text-stone-600">
            {independentLocked ? "この判定は確定済みで変更できません。" : "この段階では、ほかの確認者の回答は表示されません。"}
          </p>
          <ReviewFields
            disabled={independentLocked || busy}
            draft={independentLocked && independentDraft ? independentDraft : draft}
            idPrefix="adjudication-independent"
            onChange={updateDraft}
            reviewCase={props.reviewCase}
          />
          {!independentLocked ? (
            <>
              <label className="mt-5 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm">
                <input checked={lockConfirmed} className="mt-1" onChange={(event) => setLockConfirmed(event.target.checked)} type="checkbox" />
                <span>この独立判定は確定後に変更できないことを確認しました。</span>
              </label>
              <button
                className="button mt-4 w-full bg-violet-700 hover:bg-violet-800"
                disabled={busy || !lockConfirmed}
                onClick={() => {
                  ++saveSequence.current;
                  perform({
                    action: "lock_independent",
                    adjudicationId: props.adjudication.id,
                    idempotencyKey: makeKey(),
                    confirmation: "lock_blind_judgment",
                    draft: { caseId: props.reviewCase.id, ...draft, complete: true },
                  }, () => {
                    setIndependentDraft({ ...draft });
                    setDirty(false);
                    setPhase("independent_locked");
                    setMessage("独立判定を確定しました。次に匿名差分を表示できます。");
                  });
                }}
                type="button"
              >独立判定を変更不可で確定</button>
              <p className="mt-3 text-xs text-stone-500">入力中の内容は自動保存され、後から再開できます。</p>
            </>
          ) : null}
        </section>

        <section className="panel h-fit">
          <h2 className="text-lg font-bold">2. 匿名差分と最終裁定</h2>
          {!independentLocked ? (
            <p className="mt-3 rounded-lg bg-stone-100 p-3 text-sm text-stone-700">独立判定を確定すると、この欄を開けます。</p>
          ) : !difference ? (
            <>
              <p className="mt-3 text-sm text-stone-700">2名の総合判定と指摘カテゴリだけを匿名で表示します。氏名やコメントは表示しません。</p>
              {differenceWasRevealed ? <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">差分は確認済みです。再表示して裁定を続けられます。</p> : null}
              <button
                className="button mt-4 w-full bg-violet-700 hover:bg-violet-800"
                disabled={busy}
                onClick={() => perform({
                  action: "reveal_differences",
                  adjudicationId: props.adjudication.id,
                  idempotencyKey: makeKey(),
                  confirmation: "reveal_anonymous_differences",
                }, (data) => {
                  setDifference(data.difference as MonitorQualityReviewAdjudicationDifference);
                  setDifferenceWasRevealed(true);
                  setMessage("匿名差分を表示しました。");
                })}
                type="button"
              >{differenceWasRevealed ? "匿名差分を再表示" : "匿名差分を表示"}</button>
            </>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <AnonymousVote label="匿名回答 A" vote={difference.reviewer_a} />
                <AnonymousVote label="匿名回答 B" vote={difference.reviewer_b} />
              </div>
              <div className="mt-5 border-t border-stone-200 pt-5">
                <h3 className="font-bold">最終裁定</h3>
                <ReviewFields disabled={busy} draft={draft} idPrefix="adjudication-final" onChange={updateDraft} reviewCase={props.reviewCase} />
                <label className="mt-5 block font-bold" htmlFor="adjudication-reason">裁定理由（必須）</label>
                <textarea className="field mt-2 min-h-28 w-full" disabled={busy} id="adjudication-reason" maxLength={500} onChange={(event) => setDecisionReason(event.target.value)} value={decisionReason} />
                <label className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm">
                  <input checked={finalConfirmed} className="mt-1" onChange={(event) => setFinalConfirmed(event.target.checked)} type="checkbox" />
                  <span>独立判定と匿名差分を確認し、この内容を最終裁定として送信します。</span>
                </label>
                <button
                  className="button mt-4 w-full bg-violet-700 hover:bg-violet-800"
                  disabled={busy || !finalConfirmed || !decisionReason.trim()}
                  onClick={() => perform({
                    action: "submit",
                    adjudicationId: props.adjudication.id,
                    idempotencyKey: makeKey(),
                    confirmation: "submit_final_adjudication",
                    decisionReason,
                    draft: { caseId: props.reviewCase.id, ...draft, complete: true },
                  }, () => {
                    setPhase("submitted");
                    setMessage("最終裁定を送信しました。");
                    router.refresh();
                  })}
                  type="button"
                >最終裁定を送信</button>
              </div>
            </>
          )}

          <details className="mt-6 border-t border-stone-200 pt-5">
            <summary className="cursor-pointer font-bold">判断できない場合</summary>
            <label className="mt-4 block font-bold" htmlFor="adjudication-abstain-reason">辞退理由（必須）</label>
            <textarea className="field mt-2 min-h-24 w-full" disabled={busy} id="adjudication-abstain-reason" maxLength={500} onChange={(event) => setAbstainReason(event.target.value)} value={abstainReason} />
            <label className="mt-4 flex items-start gap-2 text-sm">
              <input checked={abstainConfirmed} className="mt-1" onChange={(event) => setAbstainConfirmed(event.target.checked)} type="checkbox" />
              <span>理由とともにこの裁定を辞退します。元の回答や画像は削除されません。</span>
            </label>
            <button
              className="button-secondary mt-4 w-full"
              disabled={busy || !abstainConfirmed || !abstainReason.trim()}
              onClick={() => perform({
                action: "abstain",
                adjudicationId: props.adjudication.id,
                idempotencyKey: makeKey(),
                confirmation: "abstain_with_reason",
                reason: abstainReason,
              }, () => {
                setPhase("abstained");
                setMessage("裁定を辞退しました。");
                router.refresh();
              })}
              type="button"
            >この裁定を辞退</button>
          </details>
        </section>
      </div>
      {message ? <p className="panel mt-5 text-sm" role="status">{message}</p> : null}
    </div>
  );
}
