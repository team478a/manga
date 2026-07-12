import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { requireProfile } from "@/lib/auth";
import { dateJa, statusLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Work } from "@/lib/types";

export default async function DashboardWorksPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: works } = await supabase
    .from("works")
    .select("*")
    .eq("creator_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<Work[]>();

  return (
    <main className="page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">作品管理</h1>
          <p className="mt-2 text-lg text-stone-600">登録した作品の公開状態を確認し、編集できます。</p>
        </div>
        <Link className="button" href="/dashboard/works/new">作品をアップロード</Link>
      </div>
      {params.message ? <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">{params.message}</p> : null}
      {params.error ? <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{params.error}</p> : null}
      {works?.length ? (
        <div className="mt-8 grid gap-4">
          {works.map((work) => (
            <article className="panel grid gap-4 sm:grid-cols-[160px_1fr_auto] sm:items-center" key={work.id}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-linen">
                {work.image_url ? (
                  <Image src={work.image_url} alt={work.title} fill className="object-cover" sizes="160px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-stone-500">画像なし</div>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{work.title}</h2>
                <p className="mt-2 line-clamp-2 text-base text-stone-600">{work.description || "説明はまだありません。"}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-linen px-3 py-1">{work.is_public ? "公開" : "非公開"}</span>
                  <span className="rounded-full bg-linen px-3 py-1">{statusLabel(work.status)}</span>
                  <span className="rounded-full bg-linen px-3 py-1">作成日：{dateJa(work.created_at)}</span>
                </div>
              </div>
              <Link className="button-secondary whitespace-nowrap" href={`/dashboard/works/${work.id}/edit`}>
                編集する
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState title="作品はまだありません" body="画像と説明を登録して、作品ページを作りましょう。" href="/dashboard/works/new" action="作品をアップロード" />
        </div>
      )}
    </main>
  );
}
