import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { yen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { DigitalProduct, Work } from "@/lib/types";

export default async function WorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: work } = await supabase
    .from("works")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle<Work>();

  if (!work) notFound();

  const { data: products } = await supabase
    .from("digital_products")
    .select("id,work_id,creator_id,title,description,price,status,created_at")
    .eq("work_id", work.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<DigitalProduct[]>();

  return (
    <main className="page">
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-linen">
          {work.image_url ? (
            <Image src={work.image_url} alt={work.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
          ) : (
            <div className="flex h-full items-center justify-center text-stone-500">画像未登録</div>
          )}
        </div>
        <section>
          <h1 className="text-4xl font-bold">{work.title}</h1>
          <p className="mt-5 whitespace-pre-wrap text-lg leading-relaxed text-stone-700">{work.description || "説明はまだありません。"}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {work.tags?.map((tag) => <span className="rounded-full bg-linen px-3 py-1 text-sm" key={tag}>{tag}</span>)}
          </div>
        </section>
      </div>
      <section className="mt-10">
        <h2 className="text-2xl font-bold">販売中の商品</h2>
        <div className="mt-4 grid gap-4">
          {products?.length ? products.map((product) => (
            <div className="panel flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" key={product.id}>
              <div>
                <h3 className="text-xl font-bold">{product.title}</h3>
                <p className="mt-1 text-stone-600">{product.description}</p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <p className="text-2xl font-bold">税込 {yen(product.price)}</p>
                <Link className="button" href={`/checkout/${product.id}`}>購入ボタン</Link>
              </div>
            </div>
          )) : <p className="mt-3 text-lg text-stone-600">販売中の商品はまだありません。</p>}
        </div>
      </section>
    </main>
  );
}
