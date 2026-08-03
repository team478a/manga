import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const labels = { release: "新機能", improvement: "改善", fix: "不具合修正", maintenance: "メンテナンス" } as const;

export default async function ProductUpdateDetailPage({ params }: { params: Promise<{ updateId: string }> }) {
  await requireProfile();
  const parsed = z.string().uuid().safeParse((await params).updateId);
  if (!parsed.success) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("cloud_product_updates")
    .select("id,title,summary,details,category,action_url,published_at")
    .eq("id", parsed.data).maybeSingle();
  if (error || !data) notFound();
  return <main className="page max-w-3xl">
    <Link className="text-violet-700 underline" href="/dashboard/updates">← 更新情報一覧</Link>
    <article className="panel mt-5">
      <p className="text-sm font-bold text-violet-700">{labels[data.category as keyof typeof labels] ?? "更新"}</p>
      <h1 className="mt-2 text-3xl font-bold">{data.title}</h1>
      <p className="mt-2 text-sm text-stone-500">{data.published_at ? new Date(data.published_at).toLocaleDateString("ja-JP") : ""}</p>
      <p className="mt-6 text-lg font-semibold leading-relaxed text-stone-800">{data.summary}</p>
      {data.details ? <div className="mt-5 whitespace-pre-wrap border-t border-stone-200 pt-5 leading-relaxed text-stone-700">{data.details}</div> : null}
      {data.action_url ? <Link className="button mt-6 bg-violet-700 hover:bg-violet-800" href={data.action_url}>関連画面を開く</Link> : null}
    </article>
  </main>;
}
