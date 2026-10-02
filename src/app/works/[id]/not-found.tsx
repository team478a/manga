import Link from "next/link";
import { BookX } from "lucide-react";

export default function WorkNotFound() {
  return (
    <main className="marketplace-page">
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm sm:p-9">
          <BookX
            aria-hidden="true"
            className="mx-auto h-9 w-9 text-violet-600"
          />
          <h1 className="mt-4 text-2xl font-black text-stone-900">
            作品が見つかりません
          </h1>
          <p className="mt-3 leading-7 text-stone-600">
            公開が終了したか、URLが変更された可能性があります。本棚で購入済み作品を読む場合は、本棚から開いてください。
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-violet-700 px-5 font-bold text-white outline-none transition hover:bg-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              href="/works"
            >
              漫画を探す
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-stone-300 bg-white px-5 font-bold text-stone-900 outline-none transition hover:border-violet-300 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              href="/dashboard/purchases"
            >
              本棚を開く
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
