"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function WorksError({ reset }: { reset: () => void }) {
  return (
    <main className="marketplace-page">
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <section
          className="rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm sm:p-9"
          role="alert"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mx-auto h-9 w-9 text-red-600"
          />
          <h1 className="mt-4 text-2xl font-black text-stone-900">
            作品情報を表示できませんでした
          </h1>
          <p className="mt-3 leading-7 text-stone-600">
            一時的に漫画の情報を取得できませんでした。購入や作品の情報は変更されていません。
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-violet-700 px-5 font-bold text-white outline-none transition hover:bg-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              onClick={reset}
              type="button"
            >
              もう一度読み込む
            </button>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-stone-300 bg-white px-5 font-bold text-stone-900 outline-none transition hover:border-violet-300 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              href="/works"
            >
              漫画を探すへ戻る
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
