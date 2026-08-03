import Link from "next/link";
import { Megaphone } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const labels = { release: "新機能", improvement: "改善", fix: "不具合修正", maintenance: "メンテナンス" } as const;

export default async function ProductUpdatesPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.from("cloud_product_updates")
    .select("id,title,summary,category,published_at")
    .order("published_at", { ascending: false }).limit(100);
  return <main className="page max-w-4xl">
    <Link className="text-violet-700 underline" href="/dashboard">← ダッシュボード</Link>
    <div className="mt-4 flex items-center gap-3"><Megaphone className="h-7 w-7 text-violet-700"/><h1 className="text-3xl font-bold">更新情報</h1></div>
    <p className="mt-2 text-stone-600">新機能、改善、不具合修正のお知らせです。</p>
    {error ? <p className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-950">更新情報を読み込めませんでした。時間をおいて再度お試しください。</p> : null}
    <section className="mt-6 space-y-3">{(data ?? []).map((item) => <Link className="panel block transition hover:border-violet-300 hover:bg-violet-50/40" href={`/dashboard/updates/${item.id}`} key={item.id}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold text-violet-700">{labels[item.category as keyof typeof labels] ?? "更新"}</p><h2 className="mt-1 text-xl font-bold">{item.title}</h2><p className="mt-2 text-stone-600">{item.summary}</p></div><time className="shrink-0 text-xs text-stone-500">{item.published_at ? new Date(item.published_at).toLocaleDateString("ja-JP") : ""}</time></div>
    </Link>)}{!error && !data?.length ? <div className="panel text-stone-600">更新情報はまだありません。</div> : null}</section>
  </main>;
}
