import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { requireProfile } from "@/lib/auth";
import { dateJa, statusLabel, yen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type ProductRow = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  status: string;
  created_at: string;
  works: { title: string } | null;
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("digital_products")
    .select("id,title,description,price,status,created_at,works:work_id(title)")
    .eq("creator_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<ProductRow[]>();

  return (
    <main className="page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">デジタル商品管理</h1>
          <p className="mt-3 text-lg leading-relaxed text-stone-600">
            デジタル商品とは、購入者があとでダウンロードできるPDF、画像、ZIPなどの販売ファイルです。
          </p>
        </div>
        <Link className="button" href="/dashboard/products/new">
          商品を登録
        </Link>
      </div>
      {params.message ? <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">{params.message}</p> : null}
      {params.error ? <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{params.error}</p> : null}

      {products?.length ? (
        <div className="mt-8 grid gap-4">
          {products.map((product) => (
            <article className="panel grid gap-4 lg:grid-cols-[1fr_160px_120px_auto] lg:items-center" key={product.id}>
              <div>
                <h2 className="text-2xl font-bold">{product.title}</h2>
                <p className="mt-2 text-base text-stone-600">紐づく作品：{product.works?.title ?? "未設定"}</p>
                <p className="mt-1 line-clamp-2 text-base text-stone-600">{product.description || "説明はまだありません。"}</p>
                <p className="mt-2 text-sm text-stone-500">作成日：{dateJa(product.created_at)}</p>
              </div>
              <p className="text-xl font-bold">{yen(product.price)}</p>
              <StatusBadge className="w-fit text-sm">{statusLabel(product.status)}</StatusBadge>
              <Link className="button-secondary whitespace-nowrap" href={`/dashboard/products/${product.id}/edit`}>
                編集する
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="デジタル商品はまだありません"
            body="作品に紐づけて、販売用のPDFやZIPなどを登録できます。"
            href="/dashboard/products/new"
            action="商品を登録"
          />
        </div>
      )}
    </main>
  );
}
