"use client";

export default function CloudAdultWorksError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <main className="page">
      <h1 className="text-3xl font-bold">成人向け作品管理</h1>
      <div className="panel mt-6">
        <p role="alert">作品管理を読み込めませんでした。</p>
        <button className="button-secondary mt-4" onClick={reset} type="button">
          再読み込み
        </button>
      </div>
    </main>
  );
}
