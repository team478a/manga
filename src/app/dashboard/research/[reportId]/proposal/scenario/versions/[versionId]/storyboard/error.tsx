"use client";

export default function StoryboardError({ reset }: { reset: () => void }) {
  return (
    <main className="page max-w-3xl">
      <section className="panel text-center">
        <h1 className="text-2xl font-bold">ネームを表示できませんでした</h1>
        <p className="mt-2 text-stone-600">
          入力内容や内部エラーの詳細は表示していません。時間を置いて、もう一度お試しください。
        </p>
        <button className="button-secondary mt-5" onClick={reset}>
          再試行
        </button>
      </section>
    </main>
  );
}
