import { notFound } from "next/navigation";
import Image from "next/image";
import { updateWork } from "@/app/actions";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Work } from "@/lib/types";

export default async function EditWorkPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
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

  return (
    <main className="page max-w-3xl">
      <h1 className="text-3xl font-bold">作品編集</h1>
      {messages.error ? <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{messages.error}</p> : null}
      <form action={updateWork} className="panel mt-6 space-y-5">
        <input name="id" type="hidden" value={work.id} />
        {work.image_url ? (
          <div>
            <p className="label">現在の画像</p>
            <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-lg bg-linen">
              <Image src={work.image_url} alt={work.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" />
            </div>
          </div>
        ) : null}
        <div>
          <label className="label" htmlFor="title">作品名</label>
          <p className="mt-1 text-base text-stone-600">作品ページの一番上に表示されます。</p>
          <input className="field" id="title" name="title" defaultValue={work.title} required />
        </div>
        <div>
          <label className="label" htmlFor="description">作品説明</label>
          <p className="mt-1 text-base text-stone-600">作品の魅力や制作意図を編集できます。</p>
          <textarea className="field min-h-36" id="description" name="description" defaultValue={work.description ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="image">作品画像を差し替える</label>
          <p className="mt-1 text-base text-stone-600">変更しない場合は、何も選ばずに保存してください。JPG、PNG、WebP、10MB以内に対応しています。</p>
          <input className="field" id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
        </div>
        <div>
          <label className="label" htmlFor="tags">タグ</label>
          <p className="mt-1 text-base text-stone-600">カンマで区切ると複数登録できます。</p>
          <input className="field" id="tags" name="tags" defaultValue={work.tags?.join(", ") ?? ""} />
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
        <button className="button w-full" type="submit">更新する</button>
      </form>
    </main>
  );
}
