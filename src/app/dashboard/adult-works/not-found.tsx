import Link from "next/link";

export default function CloudAdultWorkNotFound() {
  return (
    <main className="page">
      <h1 className="text-3xl font-bold">作品が見つかりません</h1>
      <p className="mt-3 text-stone-600">
        作品が存在しないか、このアカウントには表示権限がありません。
      </p>
      <Link className="button-secondary mt-5" href="/dashboard/adult-works">
        作品一覧へ戻る
      </Link>
    </main>
  );
}
