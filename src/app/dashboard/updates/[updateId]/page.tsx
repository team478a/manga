import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ProductUpdate = {
  id: string;
  title: string;
  summary: string;
  details: string | null;
  category: "release" | "improvement" | "fix" | "maintenance";
  action_url: string | null;
  published_at: string;
};

const categoryLabels = {
  release: "新機能",
  improvement: "改善",
  fix: "不具合修正",
  maintenance: "メンテナンス",
} as const;

const isSafeInternalPath = (value: string | null) =>
  Boolean(value && value.startsWith("/") && !value.startsWith("//"));

async function loadPublishedUpdate(updateId: string) {
  try {
    const supabase = await createClient();
    const result = await supabase
      .from("cloud_product_updates")
      .select("id,title,summary,details,category,action_url,published_at")
      .eq("id", updateId)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .is("archived_at", null)
      .maybeSingle<ProductUpdate>();

    if (result.error) return { update: null, unavailable: true };
    return { update: result.data, unavailable: false };
  } catch {
    return { update: null, unavailable: true };
  }
}

export default async function ProductUpdatePage({
  params,
}: {
  params: Promise<{ updateId: string }>;
}) {
  await requireProfile();
  const { updateId } = await params;
  if (!z.string().uuid().safeParse(updateId).success) notFound();
  const { update, unavailable } = await loadPublishedUpdate(updateId);
  if (!unavailable && !update) notFound();

  return (
    <main className="page max-w-3xl">
      <Link className="text-sm font-semibold text-violet-700" href="/dashboard/updates">← 更新情報へ戻る</Link>
      {unavailable || !update ? (
        <section className="panel mt-6" role="alert">
          <h1 className="text-2xl font-bold">更新情報を読み込めませんでした</h1>
          <p className="mt-2 text-stone-600">時間をおいて、もう一度読み込んでください。</p>
        </section>
      ) : (
        <article className="panel mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-bold text-violet-800">
              {categoryLabels[update.category]}
            </span>
            <time className="text-sm text-stone-500" dateTime={update.published_at}>
              {new Date(update.published_at).toLocaleString("ja-JP")}
            </time>
          </div>
          <h1 className="mt-5 break-words text-3xl font-bold">{update.title}</h1>
          <p className="mt-4 whitespace-pre-wrap break-words text-lg leading-relaxed text-stone-700">{update.summary}</p>
          {update.details ? (
            <div className="mt-6 border-t border-stone-200 pt-6">
              <h2 className="text-xl font-bold">詳しい内容</h2>
              <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-stone-700">{update.details}</p>
            </div>
          ) : null}
          {isSafeInternalPath(update.action_url) ? (
            <Link className="button mt-6 bg-violet-700 hover:bg-violet-800" href={update.action_url!}>
              関連画面を開く
            </Link>
          ) : null}
        </article>
      )}
    </main>
  );
}
