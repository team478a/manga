import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { yen } from "@/lib/format";
import {
  isMarketplaceCanaryCheckoutListing,
  isMarketplaceCanaryCheckoutTarget,
} from "@/lib/checkout-canary";
import { inspectMarketplaceCheckoutMode } from "@/lib/checkout-mode";
import {
  publicCreatorName,
  type PublicWorkCreatorAttribution,
} from "@/lib/public-creator-attribution";
import { createClient } from "@/lib/supabase/server";
import type { DigitalProduct, Work } from "@/lib/types";

export default async function WorkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: work } = await supabase
    .from("works")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .eq("content_class", "general")
    .maybeSingle<Work>();

  if (!work) notFound();
  const { data: creatorRows } = await supabase.rpc(
    "list_public_work_creator_attributions",
    { p_work_ids: [work.id] },
  );
  const creatorName = publicCreatorName(
    creatorRows as PublicWorkCreatorAttribution[] | null,
    work.id,
  );
  const checkout = inspectMarketplaceCheckoutMode();
  let buyerProfileId: string | null = null;
  if (checkout.enabled && checkout.paymentMode === "live") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle<{ id: string }>();
      buyerProfileId = profile?.id ?? null;
    }
  }

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
            <Image
              src={work.image_url}
              alt={work.title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-stone-500">
              画像未登録
            </div>
          )}
        </div>
        <section>
          <h1 className="text-4xl font-bold">{work.title}</h1>
          <p className="mt-3 text-lg font-semibold text-stone-600">
            クリエイター：{creatorName}
          </p>
          <p className="mt-5 whitespace-pre-wrap text-lg leading-relaxed text-stone-700">
            {work.description || "説明はまだありません。"}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {work.tags?.map((tag) => (
              <span
                className="rounded-full bg-linen px-3 py-1 text-sm"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      </div>
      {work.current_publication_id ? (
        <section className="mt-8 rounded-lg border border-violet-200 bg-violet-50 p-5">
          <h2 className="text-xl font-bold">漫画本文</h2>
          <p className="mt-2 text-stone-700">公開版 v{work.published_version ?? 1}に固定された原稿を表示します。</p>
          <Link className="button mt-4 inline-flex" href={`/works/${work.id}/read`}>本文を読む</Link>
        </section>
      ) : null}
      {work.sample_image_urls?.length ? (
        <section className="mt-10">
          <h2 className="text-2xl font-bold">サンプル</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {work.sample_image_urls.map((url, index) => (
              <div
                className="relative aspect-[2/3] overflow-hidden rounded-lg bg-linen"
                key={url}
              >
                <Image
                  src={url}
                  alt={`${work.title} サンプル${index + 1}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="mt-10">
        <h2 className="text-2xl font-bold">販売中の商品</h2>
        {checkout.paymentMode === "test" ? (
          <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">現在はテスト販売です。購入操作で実際の請求や売上計上は行われません。</p>
        ) : null}
        <div className="mt-4 grid gap-4">
          {products?.length ? (
            products.map((product) => {
              const canOpenCheckout = Boolean(
                checkout.enabled &&
                  checkout.paymentMode &&
                  isMarketplaceCanaryCheckoutListing({
                    paymentMode: checkout.paymentMode,
                    productId: product.id,
                    sellerProfileId: product.creator_id,
                  }),
              );
              const canPurchase = Boolean(
                canOpenCheckout &&
                  checkout.paymentMode &&
                  isMarketplaceCanaryCheckoutTarget({
                    buyerProfileId,
                    paymentMode: checkout.paymentMode,
                    productId: product.id,
                    sellerProfileId: product.creator_id,
                  }),
              );
              return (
                <div
                  className="panel flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                  key={product.id}
                >
                  <div>
                    <h3 className="text-xl font-bold">{product.title}</h3>
                    <p className="mt-1 text-stone-600">{product.description}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <p className="text-2xl font-bold">
                      税込 {yen(product.price)}
                    </p>
                    {canOpenCheckout ? (
                      <Link className="button" href={`/checkout/${product.id}`}>
                        {canPurchase
                          ? checkout.paymentMode === "test"
                            ? "テスト購入"
                            : "購入する"
                          : "購入準備へ"}
                      </Link>
                    ) : (
                      <span className="rounded-md bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-600">
                        {checkout.paymentMode === "live" ? "限定販売中" : "購入準備中"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="mt-3 text-lg text-stone-600">
              販売中の商品はまだありません。
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
