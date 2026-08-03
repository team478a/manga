"use client";

import { useEffect, useRef } from "react";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { submitCloudGeneralMonitorFeedbackAction } from "./actions";

export function MonitorFeedbackForm() {
  const diagnosticRef = useRef<HTMLInputElement>(null);
  const pageUrlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pageUrlRef.current) pageUrlRef.current.value = window.location.href.split(/[?#]/)[0];
    if (diagnosticRef.current) diagnosticRef.current.value = JSON.stringify({
      userAgent: navigator.userAgent,
      language: navigator.language,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      pathname: window.location.pathname,
      capturedAt: new Date().toISOString(),
      online: navigator.onLine,
    });
  }, []);

  return (
    <form action={submitCloudGeneralMonitorFeedbackAction} className="panel mt-6 space-y-4">
      <input name="diagnostic" ref={diagnosticRef} type="hidden" />
      <div>
        <h2 className="text-xl font-bold">感想・不具合・ご要望を送る</h2>
        <p className="mt-1 text-sm text-stone-600">画面とブラウザの情報は自動で添付されます。メールアドレスやAPIキーらしき文字列は保存前にマスクします。</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="requestType">報告の種類</label><select className="field" id="requestType" name="requestType"><option value="feedback">感想</option><option value="bug">不具合報告</option><option value="improvement">改善依頼</option><option value="feature_request">機能リクエスト</option></select></div>
        <div><label className="label" htmlFor="workflowStep">対象工程</label><select className="field" id="workflowStep" name="workflowStep"><option value="overall">全体</option><option value="research">市場分析</option><option value="proposal">AI企画</option><option value="scenario">シナリオ</option><option value="storyboard">ネーム</option><option value="canvas">原稿編集</option><option value="panel_image">コマ画像</option></select></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="feedback-title">件名</label><input className="field" id="feedback-title" maxLength={160} name="title" placeholder="例：市場分析の結果画面から先へ進めない" required /></div>
        <div><label className="label" htmlFor="rating">評価</label><select className="field" id="rating" name="rating"><option value="5">5 とても良い</option><option value="4">4 良い</option><option value="3">3 普通</option><option value="2">2 改善が必要</option><option value="1">1 利用できない</option></select></div>
        <div><label className="label" htmlFor="outcome">結果</label><select className="field" id="outcome" name="outcome"><option value="very_useful">とても役立った</option><option value="useful">役立った</option><option value="neutral">どちらでもない</option><option value="difficult">操作が難しい</option><option value="blocked">途中で進めなかった</option></select></div>
        <div><label className="label" htmlFor="severity">影響</label><select className="field" id="severity" name="severity"><option value="none">影響なし</option><option value="minor">少し困る</option><option value="major">大きく困る</option><option value="blocked">作業を続けられない</option></select></div>
        <div><label className="label" htmlFor="environment">補足する利用環境（任意）</label><input className="field" id="environment" maxLength={200} name="environment" placeholder="例：外付けディスプレイ使用" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="pageUrl">発生した画面URL</label><input className="field" id="pageUrl" maxLength={500} name="pageUrl" ref={pageUrlRef} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="screenshot">スクリーンショット（任意）</label><input accept="image/png,image/jpeg,image/webp" className="field" id="screenshot" name="screenshot" type="file" /><p className="mt-1 text-xs text-stone-500">PNG・JPEG・WebP、5MBまで。個人情報が映っていないか確認してください。</p></div>
      </div>
      <div><label className="label" htmlFor="feedback-comment">詳しい内容</label><textarea className="field min-h-32" id="feedback-comment" maxLength={2000} name="comment" placeholder="何をした時に、何が起きたか。期待していた結果も入力してください。" required /></div>
      <PendingSubmitButton className="button bg-violet-700 hover:bg-violet-800" pendingLabel="報告を安全に送信中…">報告を送信</PendingSubmitButton>
    </form>
  );
}
