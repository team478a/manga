import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { selectWorkPublication, updateWork } from "@/app/actions";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Work } from "@/lib/types";
import { CREATOR_INPUT_LIMITS } from "@/lib/creator-input";
import { listOwnedWorkPublications } from "@/modules/publication/application/work-publication-service";

export default async function EditWorkPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { profile } = await requireProfile();
  const { id } = await params;
  const messages = await searchParams;
  const supabase = await createClient();
  const { data: work } = await supabase
    .from("works")
    .select("*")
    .eq("id", id)
    .eq("creator_id", profile.id)
    .maybeSingle<Work>();

  if (!work) notFound();
  const publications = work.source_project_id ? await listOwnedWorkPublications(work.id).catch(() => []) : [];

  return (
    <main className="page max-w-3xl">
      <h1 className="text-3xl font-bold">作品編集</h1>
      {messages.error ? <InlineErrorMessage>{messages.error}</InlineErrorMessage> : null}
      {messages.message ? <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">{messages.message}</p> : null}
      {work.source_project_id ? (
        <section className="panel mt-6" aria-labelledby="publication-heading">
          <h2 className="text-xl font-bold" id="publication-heading">完成原稿との連携</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div><dt className="text-sm text-stone-500">制作Project</dt><dd className="font-semibold">連携済み</dd></div>
            <div><dt className="text-sm text-stone-500">公開version</dt><dd className="font-semibold">{work.published_version ? `v${work.published_version}` : "未固定"}</dd></div>
            <div><dt className="text-sm text-stone-500">本文ページ数</dt><dd className="font-semibold">{publications.find((item) => item.current)?.pageCount ?? 0}ページ</dd></div>
          </dl>
          {work.current_publication_id ? <Link className="button-secondary mt-4 inline-flex" href={`/works/${work.id}/read`}>本文を確認</Link> : null}
          {publications.length > 1 ? (
            <form action={selectWorkPublication} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <input name="workId" type="hidden" value={work.id} />
              <div className="flex-1">
                <label className="label" htmlFor="publicationId">使用する完成版</label>
                <select className="field" defaultValue={work.current_publication_id ?? ""} id="publicationId" name="publicationId">
                  {publications.map((item) => <option key={item.id} value={item.id}>v{item.version}・{item.pageCount}ページ・{new Date(item.createdAt).toLocaleString("ja-JP")}</option>)}
                </select>
              </div>
              <PendingSubmitButton className="button-secondary" pendingLabel="切り替え中…">完成版を切り替える</PendingSubmitButton>
            </form>
          ) : null}
          {(work.is_public || work.status === "published") && publications.length > 1 ? <p className="mt-3 text-sm text-amber-800">公開中は完成版を切り替えません。先に作品と商品の公開を停止してください。</p> : null}
        </section>
      ) : null}
      <form action={updateWork} className="panel mt-6 space-y-5">
        <input name="id" type="hidden" value={work.id} />
        {work.image_url ? (
          <div>
            <p className="label">表紙画像・販売用サムネイル</p>
            <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-lg bg-linen">
              <Image src={work.image_url} alt={work.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" />
            </div>
          </div>
        ) : null}
        <div>
          <label className="label" htmlFor="title">作品名</label>
          <p className="mt-1 text-base text-stone-600">作品ページの一番上に表示されます。</p>
          <input className="field" id="title" name="title" defaultValue={work.title} maxLength={CREATOR_INPUT_LIMITS.workTitle} required />
        </div>
        <div>
          <label className="label" htmlFor="description">作品説明</label>
          <p className="mt-1 text-base text-stone-600">作品の魅力や制作意図を編集できます。</p>
          <textarea className="field min-h-36" id="description" name="description" defaultValue={work.description ?? ""} maxLength={CREATOR_INPUT_LIMITS.workDescription} />
        </div>
        <div>
          <label className="label" htmlFor="image">作品画像を差し替える</label>
          <p className="mt-1 text-base text-stone-600">変更しない場合は、何も選ばずに保存してください。JPG、PNG、WebP、10MB以内に対応しています。</p>
          <input className="field" id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
        </div>
        <div>
          <label className="label" htmlFor="tags">タグ</label>
          <p className="mt-1 text-base text-stone-600">カンマで区切ると複数登録できます。</p>
          <input className="field" id="tags" name="tags" defaultValue={work.tags?.join(", ") ?? ""} maxLength={CREATOR_INPUT_LIMITS.tagCount * (CREATOR_INPUT_LIMITS.tagLength + 1)} />
        </div>
        <fieldset>
          <legend className="label">公開設定</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-300 p-4">
              <input className="mt-1 h-5 w-5" name="visibility" type="radio" value="private" defaultChecked={!work.is_public} />
              <span>
                <span className="block text-lg font-semibold">非公開</span>
                <span className="mt-1 block text-base text-stone-600">自分だけが管理画面で確認できます。</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-300 p-4">
              <input className="mt-1 h-5 w-5" name="visibility" type="radio" value="public" defaultChecked={work.is_public} />
              <span>
                <span className="block text-lg font-semibold">公開</span>
                <span className="mt-1 block text-base text-stone-600">公開作品一覧に表示されます。</span>
              </span>
            </label>
          </div>
        </fieldset>
        <PendingSubmitButton className="button w-full" pendingLabel="作品を更新中…">更新する</PendingSubmitButton>
      </form>
    </main>
  );
}
