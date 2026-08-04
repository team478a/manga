import Link from "next/link";
import { Megaphone } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ProductUpdate = {
  id: string;
  title: string;
  summary: string;
  category: "release" | "improvement" | "fix" | "maintenance";
  published_at: string;
};

const categoryLabels = {
  release: "新機能",
  improvement: "改善",
  fix: "不具合修正",
  maintenance: "メンテナンス",
} as const;

async function loadPublishedUpdates() {
  try {
    const supabase = await createClient();
    const result = await supabase
      .from("cloud_product_updates")
      .select("id,title,summary,category,published_at")
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .is("archived_at", null)
      .order("published_at", { ascending: false })
      .limit(100)
      .returns<ProductUpdate[]>();

    if (result.error) return { updates: [] as ProductUpdate[], unavailable: true };
    return { updates: result.data ?? [], unavailable: false };
  } catch {
    return { updates: [] as ProductUpdate[], unavailable: true };
  }
}

export default async function ProductUpdatesPage() {
  await requireProfile();
  const { updates, unavailable } = await loadPublishedUpdates();

  return (
    <main className="page max-w-4xl">
      <Link className="text-sm font-semibold text-violet-700" href="/dashboard">← ダッシュボードへ</Link>
      <div className="mt-4 flex items-center gap-3">
        <Megaphone className="h-7 w-7 text-violet-700" />
        <div>
          <h1 className="text-3xl font-bold">更新情報</h1>
          <p className="mt-1 text-stone-600">新機能、改善、不具合修正のお知らせを確認できます。</p>
        </div>
      </div>

      {unavailable ? (
        <section className="panel mt-6" role="alert">
          <h2 className="text-xl font-bold">更新情報を読み込めませんでした</h2>
          <p className="mt-2 text-stone-600">時間をおいて、もう一度読み込んでください。</p>
        </section>
      ) : (
        <section className="mt-6 space-y-3">
          {updates.map((item) => (
            <article className="panel" key={item.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-violet-700">{categoryLabels[item.category]}</p>
                  <h2 className="mt-1 break-words text-xl font-bold">
                    <Link className="hover:text-violet-700 hover:underline" href={`/dashboard/updates/${item.id}`}>
                      {item.title}
                    </Link>
                  </h2>
                  <p className="mt-2 break-words text-stone-700">{item.summary}</p>
                </div>
                <time className="shrink-0 text-sm text-stone-500" dateTime={item.published_at}>
                  {new Date(item.published_at).toLocaleDateString("ja-JP")}
                </time>
              </div>
              <Link className="mt-4 inline-flex text-sm font-semibold text-violet-700" href={`/dashboard/updates/${item.id}`}>
                詳しく見る →
              </Link>
            </article>
          ))}
          {!updates.length ? <div className="panel text-stone-600">公開中の更新情報はありません。</div> : null}
        </section>
      )}
    </main>
  );
}
