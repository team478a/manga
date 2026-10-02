import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  CircleUserRound,
  ShoppingBag,
} from "lucide-react";
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
  const { data: work, error: workError } = await supabase
    .from("works")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .eq("content_class", "general")
    .maybeSingle<Work>();

  if (workError) throw new Error("marketplace_work_load_failed");
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

  const { data: products, error: productsError } = await supabase
    .from("digital_products")
    .select("id,work_id,creator_id,title,description,price,status,created_at")
    .eq("work_id", work.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<DigitalProduct[]>();
  if (productsError) throw new Error("marketplace_products_load_failed");
  const activeProducts = products ?? [];
  const lowestPrice = activeProducts.length
    ? Math.min(...activeProducts.map((product) => product.price))
    : null;
  const hasPreview = Boolean(
    work.current_publication_id || work.sample_image_urls?.length,
  );

  return (
    <main className="marketplace-page">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        <Link
          className="inline-flex min-h-10 items-center gap-1 rounded-md text-sm font-bold text-stone-600 outline-none hover:text-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          href="/works"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          漫画を探すへ戻る
        </Link>

        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(260px,380px)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
          <aside className="mx-auto w-full max-w-sm lg:mx-0">
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-xl shadow-stone-900/10">
              {work.image_url ? (
                <Image
                  alt={`${work.title}の表紙`}
                  className="object-cover"
                  fill
                  priority
                  sizes="(max-width: 1023px) 85vw, 380px"
                  src={work.image_url}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-violet-100 to-stone-100 px-6 text-center text-stone-500">
                  <span className="text-sm font-black tracking-[0.18em] text-violet-700">
                    MANGAI
                  </span>
                  <span className="mt-4 font-bold">表紙準備中</span>
                </div>
              )}
            </div>
          </aside>

          <section className="min-w-0 lg:pt-3">
            <p className="text-sm font-black tracking-[0.16em] text-violet-700">
              MANGAI COMICS
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-stone-950 sm:text-4xl lg:text-5xl">
              {work.title}
            </h1>
            <p className="mt-4 text-base font-bold text-stone-600 sm:text-lg">
              クリエイター：{creatorName}
            </p>

            {work.tags?.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {work.tags.map((tag) => (
                  <Link
                    className="marketplace-filter-chip"
                    href={`/works?tag=${encodeURIComponent(tag)}`}
                    key={tag}
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-7 border-y border-stone-200 py-6">
              {lowestPrice !== null ? (
                <div>
                  <p className="text-xs font-bold text-stone-500">販売価格</p>
                  <p className="mt-1 text-3xl font-black text-stone-950">
                    {yen(lowestPrice)}円
                    <span className="ml-1 text-sm font-semibold text-stone-500">
                      税込{activeProducts.length > 1 ? "〜" : ""}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="text-sm font-semibold text-stone-500">
                  販売中の商品はまだありません。
                </p>
              )}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                {work.current_publication_id ? (
                  <Link
                    className="inline-flex min-h-12 items-center justify-center rounded-lg bg-violet-700 px-5 text-base font-bold text-white outline-none transition hover:bg-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                    href={`/works/${work.id}/read`}
                  >
                    <BookOpen aria-hidden="true" className="mr-2 h-5 w-5" />
                    漫画を読む・試し読み
                  </Link>
                ) : work.sample_image_urls?.length ? (
                  <Link
                    className="inline-flex min-h-12 items-center justify-center rounded-lg bg-violet-700 px-5 text-base font-bold text-white outline-none transition hover:bg-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                    href="#preview"
                  >
                    <BookOpen aria-hidden="true" className="mr-2 h-5 w-5" />
                    サンプルを試し読み
                  </Link>
                ) : null}
                {activeProducts.length ? (
                  <Link
                    className="inline-flex min-h-12 items-center justify-center rounded-lg border border-stone-300 bg-white px-5 text-base font-bold text-stone-900 outline-none transition hover:border-violet-300 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                    href="#purchase"
                  >
                    <ShoppingBag aria-hidden="true" className="mr-2 h-5 w-5" />
                    購入方法を見る
                  </Link>
                ) : null}
              </div>
              {hasPreview ? (
                <p className="mt-3 text-sm leading-relaxed text-stone-500">
                  購入前に作品の一部を確認できます。
                </p>
              ) : null}
            </div>

            <section aria-labelledby="work-synopsis" className="mt-7">
              <h2 className="text-xl font-black text-stone-900" id="work-synopsis">
                作品について
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-stone-700">
                {work.description || "あらすじはまだありません。"}
              </p>
            </section>
          </section>
        </div>

        {work.current_publication_id ? (
          <section
            aria-labelledby="fixed-publication-preview"
            className="mt-12 overflow-hidden rounded-2xl bg-violet-950 px-5 py-7 text-white sm:px-8 sm:py-9"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-violet-200">
                  READ BEFORE YOU BUY
                </p>
                <h2
                  className="mt-2 text-2xl font-black sm:text-3xl"
                  id="fixed-publication-preview"
                >
                  まずは作品を読んでみる
                </h2>
                <p className="mt-2 max-w-2xl leading-7 text-violet-100">
                  固定された公開版の本文を読むことができます。購入前は試し読みページを表示します。
                </p>
              </div>
              <Link
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-white px-5 text-base font-bold text-violet-950 outline-none transition hover:bg-violet-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-violet-950"
                href={`/works/${work.id}/read`}
              >
                無料で試し読み
                <ChevronRight aria-hidden="true" className="ml-1 h-5 w-5" />
              </Link>
            </div>
          </section>
        ) : null}

        {work.sample_image_urls?.length ? (
          <section aria-labelledby="preview-title" className="mt-12" id="preview">
            <p className="text-xs font-black tracking-[0.16em] text-violet-700">
              SAMPLE
            </p>
            <h2
              className="mt-2 text-2xl font-black tracking-tight text-stone-900 sm:text-3xl"
              id="preview-title"
            >
              試し読み
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600 sm:text-base">
              サンプル画像で、絵柄や物語の雰囲気を確認できます。
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {work.sample_image_urls.map((url, index) => (
                <div
                  className="relative aspect-[2/3] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"
                  key={url}
                >
                  <Image
                    alt={`${work.title} サンプル${index + 1}`}
                    className="object-contain"
                    fill
                    sizes="(max-width: 639px) 92vw, (max-width: 1023px) 46vw, 30vw"
                    src={url}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="purchase-title" className="mt-12" id="purchase">
          <p className="text-xs font-black tracking-[0.16em] text-violet-700">
            DIGITAL EDITION
          </p>
          <h2
            className="mt-2 text-2xl font-black tracking-tight text-stone-900 sm:text-3xl"
            id="purchase-title"
          >
            デジタル版を購入
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600 sm:text-base">
            商品と価格を確認して、購入準備へ進んでください。
          </p>
          {checkout.paymentMode === "test" ? (
            <p
              className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950"
              role="status"
            >
              現在はテスト販売です。購入操作で実際の請求や売上計上は行われません。
            </p>
          ) : null}
          <div className="mt-5 grid gap-4">
            {activeProducts.length ? (
              activeProducts.map((product) => {
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
                  <article
                    className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6"
                    key={product.id}
                  >
                    <div className="min-w-0">
                      <h3 className="text-lg font-black text-stone-900 sm:text-xl">
                        {product.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-stone-600 sm:text-base">
                        {product.description || "デジタル商品です。"}
                      </p>
                    </div>
                    <div className="mt-5 flex shrink-0 flex-col gap-3 sm:mt-0 sm:min-w-48 sm:items-end">
                      <p className="text-2xl font-black text-stone-950">
                        {yen(product.price)}円
                        <span className="ml-1 text-xs font-semibold text-stone-500">
                          税込
                        </span>
                      </p>
                      {canOpenCheckout ? (
                        <Link
                          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-violet-700 px-5 text-base font-bold text-white outline-none transition hover:bg-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 sm:w-auto"
                          href={`/checkout/${product.id}`}
                        >
                          {canPurchase
                            ? checkout.paymentMode === "test"
                              ? "テスト購入"
                              : "購入する"
                            : "購入準備へ"}
                        </Link>
                      ) : (
                        <span className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-stone-100 px-4 text-sm font-bold text-stone-600 sm:w-auto">
                          {checkout.paymentMode === "live"
                            ? "限定販売中"
                            : "購入準備中"}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
                販売中の商品はまだありません。
              </div>
            )}
          </div>
        </section>

        <section
          aria-labelledby="creator-title"
          className="mt-12 rounded-2xl border border-violet-100 bg-violet-50 p-5 sm:p-7"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-violet-700 shadow-sm">
              <CircleUserRound aria-hidden="true" className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black tracking-[0.16em] text-violet-700">
                CREATOR
              </p>
              <h2 className="mt-1 text-xl font-black text-stone-900" id="creator-title">
                この作品のクリエイター
              </h2>
              <p className="mt-2 text-lg font-bold text-stone-800">{creatorName}</p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
                MANGAIで作品を公開しているインディーズ漫画クリエイターです。
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
