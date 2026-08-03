"use client";

import Link from "next/link";

export default function GeneralMonitorWelcomeError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page max-w-3xl">
      <p className="font-semibold text-violet-700">一般向け・招待制モニター</p>
      <h1 className="mt-2 text-3xl font-bold">画面を読み込めませんでした</h1>
      <section className="panel mt-6" role="alert">
        <h2 className="text-xl font-bold">操作内容は失われていません</h2>
        <p className="mt-3 text-stone-600">
          一時的にモニター情報を確認できませんでした。再読み込みしても解消しない場合は、ダッシュボードへ戻ってからもう一度お試しください。
        </p>
      </section>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button className="button bg-violet-700 hover:bg-violet-800" onClick={reset} type="button">
          もう一度読み込む
        </button>
        <Link className="button-secondary" href="/dashboard">ダッシュボードへ戻る</Link>
      </div>
    </main>
  );
}
