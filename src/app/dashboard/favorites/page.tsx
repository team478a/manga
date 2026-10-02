import Link from "next/link";
import { ArrowLeft, Heart, RefreshCw, Search } from "lucide-react";
import { MarketplaceWorkCard } from "@/components/marketplace/MarketplaceWorkCard";
import { requireProfile } from "@/lib/auth";
import { inspectMarketplaceCheckoutMode } from "@/lib/checkout-mode";
import {
  summarizeMarketplaceCatalogSale,
  type MarketplaceCatalogProduct,
} from "@/lib/marketplace-catalog";
import { loadMarketplaceFavoriteSnapshot } from "@/lib/marketplace-favorites";
import {
  mapPublicWorkCreatorAttributions,
  type PublicWorkCreatorAttribution,
} from "@/lib/public-creator-attribution";
import { createClient } from "@/lib/supabase/server";
import type { Work } from "@/lib/types";

type FavoriteWork = Work & {
  digital_products: MarketplaceCatalogProduct[] | null;
};

export default async function MarketplaceFavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{
    favorite_error?: string;
    favorite_message?: string;
  }>;
}) {
  const query = await searchParams;
  await requireProfile();
  const snapshot = await loadMarketplaceFavoriteSnapshot();
  const supabase = await createClient();
  const favoriteOrder = new Map(
    snapshot.rows.map((row, index) => [row.work_id, index]),
  );
  let works: FavoriteWork[] = [];
  let loadFailed = snapshot.availability === "unavailable";

  if (snapshot.rows.length) {
    const result = await supabase
      .from("works")
      .select("*,digital_products(price,status)")
      .in(
        "id",
        snapshot.rows.map((row) => row.work_id),
      )
      .eq("is_public", true)
      .eq("content_class", "general")
      .eq("digital_products.status", "active")
      .returns<FavoriteWork[]>();
    loadFailed = loadFailed || Boolean(result.error);
    works = (result.data ?? []).sort(
      (left, right) =>
        (favoriteOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (favoriteOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  let creatorRows: PublicWorkCreatorAttribution[] | null = null;
  if (works.length) {
    const result = await supabase.rpc(
      "list_public_work_creator_attributions",
      { p_work_ids: works.map((work) => work.id) },
    );
    creatorRows = result.data as PublicWorkCreatorAttribution[] | null;
    loadFailed = loadFailed || Boolean(result.error);
  }
  const creatorByWork = mapPublicWorkCreatorAttributions(creatorRows);
  const checkout = inspectMarketplaceCheckoutMode();

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

        <header className="mt-4 border-b border-stone-200 pb-7 sm:flex sm:items-end sm:justify-between sm:gap-6">
          <div>
            <p className="text-xs font-black tracking-[0.18em] text-violet-700">
              READ LATER
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
              あとで読む
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-stone-600">
              気になる公開作品を保存して、購入とは別にまとめて確認できます。
            </p>
          </div>
          {!loadFailed && works.length ? (
            <p className="mt-4 text-sm font-bold text-stone-500 sm:mt-0">
              {works.length}件の作品
            </p>
          ) : null}
        </header>

        {query.favorite_error ? (
          <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
            {query.favorite_error}
          </p>
        ) : null}
        {query.favorite_message ? (
          <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
            {query.favorite_message}
          </p>
        ) : null}

        <section aria-label="あとで読むに保存した漫画" className="mt-7">
          {loadFailed ? (
            <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="font-bold text-stone-900">
                あとで読むを読み込めませんでした。
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                保存状態は変更されていません。機能準備後または時間をおいて再読み込みしてください。
              </p>
              <Link
                className="mt-5 inline-flex min-h-12 items-center justify-center rounded-lg border border-stone-300 bg-white px-5 font-bold text-stone-900 outline-none transition hover:border-violet-300 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                href="/dashboard/favorites"
              >
                <RefreshCw aria-hidden="true" className="mr-2 h-5 w-5" />
                再読み込み
              </Link>
            </div>
          ) : works.length ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
              {works.map((work) => (
                <MarketplaceWorkCard
                  creatorName={creatorByWork.get(work.id) ?? "クリエイター"}
                  favoriteControl={{
                    availability: "ready",
                    isFavorite: true,
                    returnTo: "/dashboard/favorites",
                  }}
                  key={work.id}
                  sale={summarizeMarketplaceCatalogSale(
                    work.digital_products,
                    checkout,
                  )}
                  work={work}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center shadow-sm sm:py-16">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                <Heart aria-hidden="true" className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-xl font-black text-stone-900">
                あとで読むはまだ空です。
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
                作品カードのハートから、気になる漫画を保存できます。
              </p>
              <Link
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-violet-700 px-5 font-bold text-white outline-none transition hover:bg-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                href="/works"
              >
                <Search aria-hidden="true" className="mr-2 h-5 w-5" />
                漫画を探す
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
