"use client";

import { useState } from "react";

type StartResponse = {
  ok?: boolean;
  error?: string;
  redirectTo?: string;
};

const fallbackMessage =
  "先行利用を開始できませんでした。時間をおいてもう一度お試しください。";

export function MonitorStartButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startMonitor() {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/monitor/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const result = (await response.json().catch(() => null)) as StartResponse | null;

      if (!response.ok || !result?.ok) {
        setError(result?.error || fallbackMessage);
        setPending(false);
        return;
      }

      window.location.assign(
        result.redirectTo || encodeURI("/dashboard?message=先行利用を開始しました"),
      );
    } catch {
      setError(fallbackMessage);
      setPending(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        aria-busy={pending}
        className="button w-full bg-violet-700 hover:bg-violet-800"
        disabled={pending}
        onClick={() => void startMonitor()}
        type="button"
      >
        {pending ? "開始準備中…" : "内容を確認して先行利用を開始"}
      </button>
      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 p-4 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
