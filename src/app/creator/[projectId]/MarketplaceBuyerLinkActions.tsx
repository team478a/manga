"use client";

import { useState } from "react";

export function MarketplaceBuyerLinkActions({
  checkoutPath,
  workTitle,
}: {
  checkoutPath: string;
  workTitle: string;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function shareCheckoutLink() {
    const url = new URL(checkoutPath, window.location.origin).toString();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: `${workTitle}の購入準備`,
          text: "MANGAIの購入準備画面です。案内された指定購入者アカウントで確認してください。",
          url,
        });
        setFeedback("共有操作が完了しました。送信先と内容を確認してください。");
        return;
      }
      if (!navigator.clipboard?.writeText)
        throw new Error("ClipboardUnavailable");
      await navigator.clipboard.writeText(url);
      setFeedback("購入準備URLをコピーしました。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setFeedback("共有をキャンセルしました。");
        return;
      }
      setFeedback(
        "URLを共有できませんでした。購入準備画面を開き、ブラウザのURLをコピーしてください。",
      );
    }
  }

  return (
    <div className="mt-3">
      <button className="button" onClick={shareCheckoutLink} type="button">
        購入準備URLを共有・コピー
      </button>
      {feedback ? (
        <p aria-live="polite" className="mt-2 text-sm leading-relaxed" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
