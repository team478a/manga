"use client";

import Link from "next/link";

export default function ProductUpdatesError({ reset }: { reset: () => void }) {
  return (
    <main className="page max-w-3xl">
      <p className="font-semibold text-violet-700">MANGAI Cloud</p>
      <h1 className="mt-2 text-3xl font-bold">更新情報を読み込めませんでした</h1>
      <section className="panel mt-6" role="alert">
        <p className="text-stone-600">一時的に情報を取得できませんでした。操作内容は失われていません。</p>
      </section>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button className="button bg-violet-700 hover:bg-violet-800" onClick={reset} type="button">もう一度読み込む</button>
        <Link className="button-secondary" href="/dashboard">ダッシュボードへ戻る</Link>
      </div>
    </main>
  );
}
