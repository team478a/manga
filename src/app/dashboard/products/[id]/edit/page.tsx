import Link from "next/link";
import { notFound } from "next/navigation";
import { updateDigitalProduct } from "@/app/actions";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DigitalProduct, Work } from "@/lib/types";

export default async function EditProductPage({
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
  const [{ data: product }, { data: works }] = await Promise.all([
    supabase.from("digital_products").select("*").eq("id", id).eq("creator_id", profile.id).maybeSingle<DigitalProduct>(),
    supabase.from("works").select("*").eq("creator_id", profile.id).order("created_at", { ascending: false }).returns<Work[]>()
  ]);

  if (!product) notFound();

  return (
    <main className="page max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">デジタル商品編集</h1>
          <p className="mt-3 text-lg leading-relaxed text-stone-600">
            商品名、価格、販売状態を変更できます。ファイルを選ばなければ、登録済みファイルをそのまま使います。
          </p>
        </div>
        <Link className="button-secondary" href="/dashboard/products">
          一覧へ戻る
        </Link>
      </div>
      {messages.error ? <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{messages.error}</p> : null}

      <form action={updateDigitalProduct} className="panel mt-6 space-y-5">
        <input name="id" type="hidden" value={product.id} />
        <div>
          <label className="label" htmlFor="workId">紐づける作品</label>
          <select className="field" id="workId" name="workId" defaultValue={product.work_id} required>
            {works?.map((work) => (
              <option key={work.id} value={work.id}>
                {work.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="title">商品名</label>
          <input className="field" id="title" name="title" defaultValue={product.title} required />
        </div>
        <div>
          <label className="label" htmlFor="description">商品説明</label>
          <textarea className="field min-h-32" id="description" name="description" defaultValue={product.description ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="price">販売価格（税込円）</label>
          <input className="field" id="price" name="price" type="number" min="0" step="1" defaultValue={product.price} required />
        </div>
        <div>
          <label className="label" htmlFor="file">ファイルを差し替える</label>
          <p className="mt-1 text-base text-stone-600">変更しない場合は、何も選ばずに保存してください。PDF、PNG、JPG、ZIP、50MB以内に対応しています。</p>
          <input className="field" id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg,application/zip,.zip" />
          {product.file_url ? <p className="mt-2 text-sm text-stone-600">登録済みファイルパス：{product.file_url}</p> : null}
        </div>
        <fieldset>
          <legend className="label">販売状態</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-300 p-4">
              <input className="mt-1 h-5 w-5" name="status" type="radio" value="active" defaultChecked={product.status === "active"} />
              <span>
                <span className="block text-lg font-semibold">販売中</span>
                <span className="mt-1 block text-base text-stone-600">公開作品ページで購入候補として表示します。</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-300 p-4">
              <input className="mt-1 h-5 w-5" name="status" type="radio" value="paused" defaultChecked={product.status === "paused"} />
              <span>
                <span className="block text-lg font-semibold">停止中</span>
                <span className="mt-1 block text-base text-stone-600">販売を止めて、管理画面だけに残します。</span>
              </span>
            </label>
          </div>
        </fieldset>
        <button className="button w-full" type="submit">更新する</button>
      </form>
    </main>
  );
}
