"use client";

import Link from "next/link";

export function AdminDataUnavailable({ title }: { title: string }) {
  return (
    <main className="page max-w-5xl">
      <p className="text-sm font-semibold text-violet-700">管理画面</p>
      <h1 className="mt-2 text-3xl font-bold">{title}を読み込めませんでした</h1>
      <section className="panel mt-6">
        <p className="text-stone-700">
          一時的に管理データへ接続できませんでした。操作内容は変更されていません。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="button bg-violet-700 hover:bg-violet-800" onClick={() => window.location.reload()} type="button">
            もう一度読み込む
          </button>
          <Link className="button-secondary" href="/admin">
            管理画面TOPへ
          </Link>
        </div>
      </section>
    </main>
  );
}
