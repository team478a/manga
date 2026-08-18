"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { MONITOR_QUALITY_REVIEW_LABELS } from "@/modules/manga-quality/domain/monitor-quality-review";
import type {
  MonitorQualityReviewCase,
  MonitorQualityReviewResponse,
} from "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";

type Draft = {
  verdict: "good" | "borderline" | "bad" | null;
  confidence: number | null;
  defects: Array<{ category: string; severity: "minor" | "major" | "critical"; comment: string }>;
  overallComment: string;
};

const emptyDraft = (): Draft => ({ verdict: null, confidence: null, defects: [], overallComment: "" });

export function MonitorQualityReviewClient(props: {
  assignmentId: string;
  initialConsented: boolean;
  initialSubmitted: boolean;
  cases: MonitorQualityReviewCase[];
  responses: MonitorQualityReviewResponse[];
}) {
  const initialDrafts = useMemo(() => Object.fromEntries(props.responses.map((item) => [
    item.case_id,
    {
      verdict: item.response_payload.verdict,
      confidence: item.response_payload.confidence,
      defects: item.response_payload.defects,
      overallComment: item.response_payload.overall_comment,
    } satisfies Draft,
  ])), [props.responses]);
  const [consented, setConsented] = useState(props.initialConsented);
  const [submitted, setSubmitted] = useState(props.initialSubmitted);
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(initialDrafts);
  const [completed, setCompleted] = useState(() => new Set(
    props.responses.filter((item) => item.case_completed_at).map((item) => item.case_id),
  ));
  const [dirtyCaseId, setDirtyCaseId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const saveSequence = useRef(0);
  const current = props.cases[index];
  const draft = current ? drafts[current.id] ?? emptyDraft() : emptyDraft();

  async function post(body: unknown) {
    const response = await fetch("/api/monitor/quality-review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "保存できませんでした。");
    return data;
  }

  function updateDraft(change: Partial<Draft>) {
    if (!current || submitted) return;
    setDrafts((value) => ({ ...value, [current.id]: { ...(value[current.id] ?? emptyDraft()), ...change } }));
    setDirtyCaseId(current.id);
    setCompleted((value) => {
      const next = new Set(value); next.delete(current.id); return next;
    });
  }

  useEffect(() => {
    if (!dirtyCaseId || !consented || submitted) return;
    const caseId = dirtyCaseId;
    const sequence = ++saveSequence.current;
    const timer = window.setTimeout(async () => {
      const value = drafts[caseId] ?? emptyDraft();
      try {
        setStatus("下書きを保存中…");
        await post({ action: "save", assignmentId: props.assignmentId, draft: { caseId, ...value, complete: false } });
        if (saveSequence.current === sequence) {
          setDirtyCaseId(null);
          setStatus("下書きを保存しました");
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "下書きを保存できませんでした。");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [consented, dirtyCaseId, drafts, props.assignmentId, submitted]);

  async function acceptConsent() {
    setBusy(true); setStatus("");
    try {
      await post({ action: "consent", assignmentId: props.assignmentId });
      setConsented(true); setStatus("確認を開始できます。");
    } catch (error) { setStatus(error instanceof Error ? error.message : "開始できませんでした。"); }
    finally { setBusy(false); }
  }

  async function completeCurrent() {
    if (!current) return;
    setBusy(true); setStatus("");
    try {
      await post({ action: "save", assignmentId: props.assignmentId, draft: { caseId: current.id, ...draft, complete: true } });
      setCompleted((value) => new Set(value).add(current.id));
      setDirtyCaseId(null);
      setStatus("この画像の判定を確定しました。");
      if (index < props.cases.length - 1) setIndex(index + 1);
    } catch (error) { setStatus(error instanceof Error ? error.message : "判定を確定できませんでした。"); }
    finally { setBusy(false); }
  }

  async function submitAll() {
    setBusy(true); setStatus("");
    try {
      await post({ action: "submit", assignmentId: props.assignmentId });
      setSubmitted(true); setStatus("すべての判定を送信しました。ご協力ありがとうございました。");
    } catch (error) { setStatus(error instanceof Error ? error.message : "送信できませんでした。"); }
    finally { setBusy(false); }
  }

  if (!consented) return (
    <section className="panel mt-6">
      <h2 className="text-xl font-bold">開始前の確認</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-stone-700">
        <li>表示された画像を、ほかの人の回答を見ずにご自身で判定してください。</li>
        <li>画像を保存・転載・共有しないでください。</li>
        <li>正解を当てる作業ではありません。迷う場合は「判断が難しい」を選べます。</li>
        <li>回答は漫画画像の品質改善と評価のために使用します。</li>
      </ul>
      <button className="button mt-5 w-full bg-violet-700 hover:bg-violet-800 sm:w-auto" disabled={busy} onClick={acceptConsent} type="button">
        内容を確認して開始
      </button>
      {status ? <p className="mt-4 text-sm" role="status">{status}</p> : null}
    </section>
  );

  if (!current) return <p className="panel mt-6">確認する画像はありません。</p>;
  const imageUrl = `/api/monitor/quality-review/image?assignmentId=${encodeURIComponent(props.assignmentId)}&caseId=${encodeURIComponent(current.id)}`;
  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="panel min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="font-bold">画像 {index + 1} / {props.cases.length}</p>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${completed.has(current.id) ? "bg-green-100 text-green-900" : "bg-stone-100 text-stone-700"}`}>
            {completed.has(current.id) ? "確定済み" : "未確定"}
          </span>
        </div>
        <div className="mt-4 flex justify-center rounded-xl bg-stone-100 p-2">
          <Image alt={`品質確認画像 ${index + 1}`} className="h-auto max-h-[70vh] w-auto rounded-lg object-contain" height={1024} priority width={704} src={imageUrl} unoptimized />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="button-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)} type="button">前の画像</button>
          <button className="button-secondary" disabled={index === props.cases.length - 1} onClick={() => setIndex(index + 1)} type="button">次の画像</button>
        </div>
      </section>
      <section className="panel h-fit">
        <h2 className="text-lg font-bold">この画像を判定</h2>
        {submitted ? <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-900">送信済みです。</p> : null}
        <fieldset className="mt-5" disabled={submitted || busy}>
          <legend className="font-bold">総合判定</legend>
          <div className="mt-2 grid gap-2">
            {([
              ["good", "良好"], ["borderline", "判断が難しい"], ["bad", "問題あり"],
            ] as const).map(([value, label]) => (
              <label className="flex items-center gap-3 rounded-lg border border-stone-200 p-3" key={value}>
                <input checked={draft.verdict === value} name="verdict" onChange={() => updateDraft({ verdict: value, defects: value === "good" ? [] : draft.defects })} type="radio" />
                <span className="font-semibold">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-5 block font-bold" htmlFor="review-confidence">確信度</label>
        <select className="field mt-2 w-full" disabled={submitted || busy} id="review-confidence" onChange={(event) => updateDraft({ confidence: Number(event.target.value) || null })} value={draft.confidence ?? ""}>
          <option value="">選択してください</option>
          {[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
        </select>
        {draft.verdict !== "good" ? (
          <fieldset className="mt-5" disabled={submitted || busy}>
            <legend className="font-bold">気になる点</legend>
            <div className="mt-2 grid gap-2">
              {current.allowed_defect_categories.map((category) => {
                const selected = draft.defects.find((item) => item.category === category);
                return <div className="rounded-lg border border-stone-200 p-3" key={category}>
                  <label className="flex items-start gap-2 text-sm"><input checked={Boolean(selected)} className="mt-1" onChange={(event) => updateDraft({ defects: event.target.checked ? [...draft.defects, { category, severity: "major", comment: "" }] : draft.defects.filter((item) => item.category !== category) })} type="checkbox" /><span>{MONITOR_QUALITY_REVIEW_LABELS[category as keyof typeof MONITOR_QUALITY_REVIEW_LABELS] ?? category}</span></label>
                  {selected ? <select aria-label={`${category}の影響度`} className="field mt-2 w-full text-sm" onChange={(event) => updateDraft({ defects: draft.defects.map((item) => item.category === category ? { ...item, severity: event.target.value as "minor" | "major" | "critical" } : item) })} value={selected.severity}><option value="minor">軽微</option><option value="major">明確</option><option value="critical">重大</option></select> : null}
                </div>;
              })}
            </div>
          </fieldset>
        ) : null}
        <label className="mt-5 block font-bold" htmlFor="review-comment">コメント（任意）</label>
        <textarea className="field mt-2 min-h-24 w-full" disabled={submitted || busy} id="review-comment" maxLength={2000} onChange={(event) => updateDraft({ overallComment: event.target.value })} value={draft.overallComment} />
        <button className="button mt-5 w-full bg-violet-700 hover:bg-violet-800" disabled={submitted || busy} onClick={completeCurrent} type="button">この画像の判定を確定</button>
        <p className="mt-3 text-xs text-stone-500">入力中の内容は自動保存され、後から再開できます。</p>
        {status ? <p className="mt-3 rounded-lg bg-stone-100 p-3 text-sm" role="status">{status}</p> : null}
        <div className="mt-6 border-t border-stone-200 pt-5">
          <p className="text-sm font-bold">確定済み {completed.size} / {props.cases.length}</p>
          <button className="button-secondary mt-3 w-full" disabled={submitted || busy || completed.size !== props.cases.length} onClick={submitAll} type="button">すべての判定を送信</button>
        </div>
      </section>
    </div>
  );
}
