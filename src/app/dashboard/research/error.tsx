"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function CloudResearchError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page max-w-3xl">
      <section className="panel text-center" role="alert">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
        <h1 className="mt-3 text-xl font-bold">
          市場分析を表示できませんでした
        </h1>
        <p className="mt-2 text-stone-600">
          内部情報は表示していません。時間をおいて再度お試しください。
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <button className="button" onClick={reset} type="button">
            再試行
          </button>
          <Link className="button-secondary" href="/dashboard/research">
            市場分析履歴へ
          </Link>
        </div>
      </section>
    </main>
  );
}
