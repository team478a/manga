import Link from "next/link";
export default function NotFound() {
  return <main className="page max-w-3xl"><section className="panel text-center"><h1 className="text-2xl font-bold">シナリオが見つかりません</h1><p className="mt-2 text-stone-600">採用企画またはシナリオを確認できませんでした。</p><Link className="button-secondary mt-5" href="/dashboard/research">市場分析へ戻る</Link></section></main>;
}
