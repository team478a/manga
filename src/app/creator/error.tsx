"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function CreatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[creator] render failure", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="page max-w-3xl">
      <p className="font-semibold text-violet-700">MANGAI Cloud 制作</p>
      <h1 className="mt-2 text-3xl font-bold">制作画面を読み込めませんでした</h1>
      <section className="panel mt-6" role="alert">
        <h2 className="text-xl font-bold">作品データは失われていません</h2>
        <p className="mt-3 text-stone-600">
          一時的に情報を取得できませんでした。もう一度読み込むか、作品一覧へ戻ってください。
        </p>
      </section>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button className="button bg-violet-700 hover:bg-violet-800" onClick={reset} type="button">
          もう一度読み込む
        </button>
        <Link className="button-secondary" href="/creator">作品一覧へ戻る</Link>
      </div>
    </main>
  );
}
