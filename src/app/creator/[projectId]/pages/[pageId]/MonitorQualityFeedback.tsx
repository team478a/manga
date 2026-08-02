"use client";

import { useState } from "react";

type Verdict = "accepted" | "needs_revision" | "unusable";

export function MonitorQualityFeedback({
  projectId,
  pageId,
  pageNumber,
  panels,
  selectedPanelId,
}: {
  projectId: string;
  pageId: string;
  pageNumber: number;
  panels: { id: string; name: string }[];
  selectedPanelId: string | null;
}) {
  const [target, setTarget] = useState(selectedPanelId ?? "page");
  const [verdict, setVerdict] = useState<Verdict>("needs_revision");
  const [issueType, setIssueType] = useState("image_quality");
  const [severity, setSeverity] = useState("minor");
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  function changeVerdict(next: Verdict) {
    setVerdict(next);
    if (next === "accepted") {
      setIssueType("none");
      setSeverity("none");
    } else if (issueType === "none" || severity === "none") {
      setIssueType("image_quality");
      setSeverity("minor");
    }
  }

  async function submit() {
    setState("saving");
    setMessage("");
    try {
      const response = await fetch("/api/creator/quality-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          pageId,
          panelId: target === "page" ? null : target,
          verdict,
          issueType,
          severity,
          comment,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存できませんでした。");
      setComment("");
      setState("saved");
      setMessage("品質フィードバックを保存しました。");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "保存できませんでした。");
    }
  }

  return (
    <section className="panel p-4">
      <p className="text-xs font-bold text-violet-700">限定モニター</p>
      <h2 className="mt-1 font-bold">この原稿を評価</h2>
      <p className="mt-1 text-xs leading-relaxed text-stone-600">
        {pageNumber}ページの気になる箇所を選ぶだけで、生成品質と修正率の改善に使われます。
      </p>
      <label className="mt-3 block text-xs font-bold" htmlFor="quality-feedback-target">対象</label>
      <select className="field mt-1 w-full" id="quality-feedback-target" value={target} onChange={(event) => setTarget(event.target.value)}>
        <option value="page">ページ全体</option>
        {panels.map((panel) => <option key={panel.id} value={panel.id}>{panel.name}</option>)}
      </select>
      <label className="mt-3 block text-xs font-bold" htmlFor="quality-feedback-verdict">判定</label>
      <select className="field mt-1 w-full" id="quality-feedback-verdict" value={verdict} onChange={(event) => changeVerdict(event.target.value as Verdict)}>
        <option value="accepted">このまま採用できる</option>
        <option value="needs_revision">修正すれば使える</option>
        <option value="unusable">作り直しが必要</option>
      </select>
      {verdict !== "accepted" ? (
        <>
          <label className="mt-3 block text-xs font-bold" htmlFor="quality-feedback-issue">気になる箇所</label>
          <select className="field mt-1 w-full" id="quality-feedback-issue" value={issueType} onChange={(event) => setIssueType(event.target.value)}>
            <option value="face">顔・表情</option><option value="hands">手・指</option>
            <option value="composition">構図・ポーズ</option><option value="consistency">キャラクター・衣装の一貫性</option>
            <option value="text">文字・吹き出し</option><option value="image_quality">画質・崩れ</option>
            <option value="missing_content">不足・欠落</option><option value="operation">操作が分かりにくい</option>
            <option value="other">その他</option>
          </select>
          <label className="mt-3 block text-xs font-bold" htmlFor="quality-feedback-severity">影響度</label>
          <select className="field mt-1 w-full" id="quality-feedback-severity" value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option value="minor">軽微</option><option value="major">大きな修正が必要</option><option value="blocked">先へ進めない</option>
          </select>
        </>
      ) : null}
      <label className="mt-3 block text-xs font-bold" htmlFor="quality-feedback-comment">補足（任意）</label>
      <textarea className="field mt-1 min-h-20 w-full" id="quality-feedback-comment" maxLength={1000} placeholder="例：右手の指だけ直したい" value={comment} onChange={(event) => setComment(event.target.value)} />
      <button className="button mt-3 w-full" disabled={state === "saving"} onClick={() => void submit()} type="button">
        {state === "saving" ? "評価を保存中…" : "評価を保存"}
      </button>
      {message ? <p className={`mt-3 rounded-lg p-2 text-xs ${state === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`} role={state === "error" ? "alert" : "status"}>{message}</p> : null}
    </section>
  );
}
