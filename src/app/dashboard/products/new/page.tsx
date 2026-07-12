import Link from "next/link";
import { createDigitalProduct } from "@/app/actions";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Work } from "@/lib/types";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
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
    <main className="page max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">デジタル商品登録</h1>
          <p className="mt-3 text-lg leading-relaxed text-stone-600">
            作品に販売用ファイルを紐づけます。ファイルは一般公開せず、購入後に取得できる設計です。
          </p>
        </div>
        <Link className="button-secondary" href="/dashboard/products">
          一覧へ戻る
        </Link>
      </div>
      {params.error ? <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{params.error}</p> : null}

      <form action={createDigitalProduct} className="panel mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="workId">紐づける作品</label>
          <p className="mt-1 text-base text-stone-600">自分が登録した作品だけ選べます。</p>
          <select className="field" id="workId" name="workId" required>
            <option value="">選んでください</option>
            {works?.map((work) => (
              <option key={work.id} value={work.id}>
                {work.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="title">商品名</label>
          <input className="field" id="title" name="title" required placeholder="例：本編PDF版" />
        </div>
        <div>
          <label className="label" htmlFor="description">商品説明</label>
          <textarea className="field min-h-32" id="description" name="description" placeholder="ファイル内容やページ数などを書いておくと安心です。" />
        </div>
        <div>
          <label className="label" htmlFor="price">販売価格（税込円）</label>
          <p className="mt-1 text-base text-stone-600">半角数字の整数で入力してください。</p>
          <input className="field" id="price" name="price" type="number" min="0" step="1" required />
        </div>
        <div>
          <label className="label" htmlFor="file">ダウンロード用ファイル</label>
          <p className="mt-1 text-base text-stone-600">PDF、PNG、JPG、ZIPに対応しています。50MB以内のファイルを選んでください。</p>
          <input className="field" id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg,application/zip,.zip" required />
        </div>
        <fieldset>
          <legend className="label">販売状態</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-300 p-4">
              <input className="mt-1 h-5 w-5" name="status" type="radio" value="active" defaultChecked />
              <span>
                <span className="block text-lg font-semibold">販売中</span>
                <span className="mt-1 block text-base text-stone-600">公開作品ページで購入候補として表示します。</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-300 p-4">
              <input className="mt-1 h-5 w-5" name="status" type="radio" value="paused" />
              <span>
                <span className="block text-lg font-semibold">停止中</span>
                <span className="mt-1 block text-base text-stone-600">準備中の商品として保存します。</span>
              </span>
            </label>
          </div>
        </fieldset>
        <button className="button w-full" type="submit">保存する</button>
      </form>
    </main>
  );
}
