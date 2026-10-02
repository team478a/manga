import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, PenLine, Search } from "lucide-react";
import { MarketplaceWorkShelf } from "@/components/marketplace/MarketplaceWorkShelf";
import { inspectMarketplaceCheckoutMode } from "@/lib/checkout-mode";
import { hasSupabaseEnv } from "@/lib/env";
import { yen } from "@/lib/format";
import {
  summarizeMarketplaceCatalogSale,
  type MarketplaceCatalogSale,
} from "@/lib/marketplace-catalog";
import {
  selectMarketplaceHomeSections,
  type MarketplaceHomeWork,
} from "@/lib/marketplace-home";
import {
  mapPublicWorkCreatorAttributions,
  type PublicWorkCreatorAttribution,
} from "@/lib/public-creator-attribution";
import { createClient } from "@/lib/supabase/server";

async function loadMarketplaceHome() {
  if (!hasSupabaseEnv()) {
    return {
      works: [] as MarketplaceHomeWork[],
      creatorByWork: new Map<string, string>(),
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("works")
    .select("*,digital_products(price,status)")
    .eq("is_public", true)
    .eq("content_class", "general")
    .eq("digital_products.status", "active")
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<MarketplaceHomeWork[]>();
  const works = data ?? [];
  let creatorRows: PublicWorkCreatorAttribution[] | null = null;

  if (works.length) {
    const result = await supabase.rpc(
      "list_public_work_creator_attributions",
      { p_work_ids: works.map((work) => work.id) },
    );
    creatorRows = result.data as PublicWorkCreatorAttribution[] | null;
  }

  return {
    works,
    creatorByWork: mapPublicWorkCreatorAttributions(creatorRows),
  };
}

export default async function Home() {
  const { works, creatorByWork } = await loadMarketplaceHome();
  const sections = selectMarketplaceHomeSections(works);
  const checkout = inspectMarketplaceCheckoutMode();
  const saleByWork = new Map<string, MarketplaceCatalogSale | null>(
    works.map((work) => [
      work.id,
      summarizeMarketplaceCatalogSale(work.digital_products, checkout),
    ]),
  );
  const featured = sections.featured;
  const featuredSale = featured ? (saleByWork.get(featured.id) ?? null) : null;

  return (
    <main className="marketplace-page overflow-hidden">
      <section className="relative border-b border-violet-100 bg-gradient-to-br from-white via-violet-50 to-stone-100">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:px-8 lg:py-16">
          <div>
            <p className="text-sm font-black tracking-[0.18em] text-violet-700">
              MANGAI DIGITAL BOOKSTORE
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-black leading-[1.15] tracking-tight text-stone-950 sm:text-5xl">
              次に夢中になる漫画を、ここで。
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-stone-600 sm:text-lg">
              個性豊かな作家と物語に出会える、インディーズ漫画のデジタル書店。まずは作品を探して、気になる一冊を読んでみよう。
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link className="button bg-violet-700 hover:bg-violet-800" href="/works">
                <Search aria-hidden="true" className="mr-2 h-5 w-5" />
                漫画を探す
              </Link>
              <Link className="button-secondary" href="/dashboard/purchases">
                <BookOpen aria-hidden="true" className="mr-2 h-5 w-5" />
                本棚を開く
              </Link>
            </div>
          </div>

          {featured ? (
            <article className="mx-auto grid w-full max-w-xl grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] items-center gap-5 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-xl shadow-violet-950/10 backdrop-blur sm:gap-7 sm:p-6">
              <Link
                className="relative aspect-[2/3] overflow-hidden rounded-xl bg-stone-100 outline-none ring-offset-4 focus-visible:ring-2 focus-visible:ring-violet-500"
                href={`/works/${featured.id}`}
              >
                {featured.image_url ? (
                  <Image
                    alt={`${featured.title}の表紙`}
                    className="object-cover"
                    fill
                    priority
                    sizes="(max-width: 1023px) 40vw, 22vw"
                    src={featured.image_url}
                  />
                ) : (
                  <span className="flex h-full items-center justify-center bg-gradient-to-br from-violet-100 to-stone-100 px-3 text-center text-sm font-bold text-violet-800">
                    表紙準備中
                  </span>
                )}
              </Link>
              <div className="min-w-0">
                <p className="text-xs font-black tracking-widest text-violet-700">
                  今、出会いたい一冊
                </p>
                <h2 className="mt-3 line-clamp-3 text-xl font-black leading-tight text-stone-950 sm:text-3xl">
                  {featured.title}
                </h2>
                <p className="mt-2 truncate text-sm text-stone-500">
                  {creatorByWork.get(featured.id) ?? "クリエイター"}
                </p>
                {featuredSale ? (
                  <p className="mt-4 text-lg font-black text-stone-900">
                    {yen(featuredSale.lowestPrice)}円
                    {featuredSale.productCount > 1 ? "〜" : ""}
                  </p>
                ) : null}
                <Link
                  className="mt-5 inline-flex min-h-11 items-center gap-1 rounded-lg bg-stone-950 px-4 text-sm font-bold text-white outline-none transition hover:bg-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                  href={`/works/${featured.id}`}
                >
                  作品を見る
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ) : (
            <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/80 bg-white/80 p-7 shadow-xl shadow-violet-950/10">
              <p className="text-sm font-black tracking-widest text-violet-700">
                NEW STORIES ARE COMING
              </p>
              <h2 className="mt-4 text-2xl font-black text-stone-950 sm:text-3xl">
                新しい物語を届ける準備中です
              </h2>
              <p className="mt-3 leading-7 text-stone-600">
                公開作品は「漫画を探す」から確認できます。新作との出会いをお楽しみに。
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <MarketplaceWorkShelf
          creatorByWork={creatorByWork}
          description="販売中の作品から、新しく公開された順にご紹介します。"
          saleByWork={saleByWork}
          title="注目作品"
          works={sections.highlighted}
        />

        <MarketplaceWorkShelf
          creatorByWork={creatorByWork}
          description="MANGAIに届いたばかりのインディーズ漫画です。"
          saleByWork={saleByWork}
          title="新着作品"
          works={sections.newest}
        />

        {sections.tags.length ? (
          <section aria-labelledby="marketplace-genres" className="py-9 sm:py-12">
            <h2
              className="text-2xl font-black tracking-tight text-stone-900 sm:text-3xl"
              id="marketplace-genres"
            >
              ジャンルから探す
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600 sm:text-base">
              公開作品に登録されたジャンル・タグから、気分に合う物語を探せます。
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {sections.tags.map((tag) => (
                <Link
                  className="marketplace-filter-chip min-h-11 px-4 text-sm"
                  href={`/works?tag=${encodeURIComponent(tag)}`}
                  key={tag}
                >
                  {tag}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <MarketplaceWorkShelf
          creatorByWork={creatorByWork}
          description="サンプルまたは公開版を、購入前に読むことができる作品です。"
          linkHref="/works"
          linkLabel="もっと探す"
          saleByWork={saleByWork}
          title="まずは試し読み"
          works={sections.previewable}
        />
      </div>

      <section className="mt-6 border-t border-violet-100 bg-violet-950 text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-11 sm:px-6 sm:py-14 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-black tracking-widest text-violet-200">
              FOR CREATORS
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              あなたの漫画を、読者へ届けませんか。
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-violet-100">
              MANGAIは、作品づくりからデジタル販売の準備までを支える制作環境も提供しています。
            </p>
          </div>
          <Link
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-white px-5 text-base font-bold text-violet-950 outline-none transition hover:bg-violet-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-violet-950"
            href="/creator"
          >
            <PenLine aria-hidden="true" className="mr-2 h-5 w-5" />
            制作環境へ
          </Link>
        </div>
      </section>
    </main>
  );
}
