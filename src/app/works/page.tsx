import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { MarketplaceSearchFilters } from "@/components/marketplace/MarketplaceSearchFilters";
import { MarketplaceInlineError } from "@/components/marketplace/MarketplaceInlineError";
import { MarketplaceWorkCard } from "@/components/marketplace/MarketplaceWorkCard";
import { inspectMarketplaceCheckoutMode } from "@/lib/checkout-mode";
import { hasSupabaseEnv } from "@/lib/env";
import {
  hasActiveMarketplaceCatalogProduct,
  prioritizeMarketplaceCatalogSales,
  summarizeMarketplaceCatalogSale,
  type MarketplaceCatalogProduct,
} from "@/lib/marketplace-catalog";
import {
  mapPublicWorkCreatorAttributions,
  type PublicWorkCreatorAttribution,
} from "@/lib/public-creator-attribution";
import { createClient } from "@/lib/supabase/server";
import type { Work } from "@/lib/types";

type WorksSearchParams = { q?: string; tag?: string; sale?: string };
type PublicCatalogWork = Work & {
  digital_products: MarketplaceCatalogProduct[] | null;
};

function safeSearchValue(value: string) {
  return value
    .replace(/[,%()]/g, " ")
    .trim()
    .slice(0, 100);
}

export default async function WorksPage({
  searchParams,
}: {
  searchParams: Promise<WorksSearchParams>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="marketplace-page">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="Supabase設定が必要です"
            body=".env.local を設定すると、公開作品一覧が表示されます。"
          />
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const keyword = safeSearchValue(params.q ?? "");
  const selectedTag = (params.tag ?? "").trim().slice(0, 50);
  const saleOnly = params.sale === "active";
  const supabase = await createClient();
  const checkout = inspectMarketplaceCheckoutMode();

  let worksQuery = supabase
    .from("works")
    .select("*,digital_products(price,status)")
    .eq("is_public", true)
    .eq("content_class", "general")
    .eq("digital_products.status", "active")
    .order("created_at", { ascending: false });

  if (keyword)
    worksQuery = worksQuery.or(
      `title.ilike.%${keyword}%,description.ilike.%${keyword}%`,
    );
  if (selectedTag) worksQuery = worksQuery.contains("tags", [selectedTag]);

  const [
    { data: works, error: worksError },
    { data: tagRows, error: tagsError },
  ] = await Promise.all([
    worksQuery.returns<PublicCatalogWork[]>(),
    supabase
      .from("works")
      .select("tags")
      .eq("is_public", true)
      .eq("content_class", "general")
      .returns<Array<{ tags: string[] | null }>>(),
  ]);
  if (worksError || tagsError) {
    return (
      <main className="marketplace-page">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-violet-700">MANGAI STORE</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            漫画を探す
          </h1>
          <div className="mt-7">
            <MarketplaceInlineError
              description="公開作品を一時的に取得できませんでした。検索条件や作品情報は変更されていません。"
              href="/works"
              title="作品一覧を読み込めませんでした"
            />
          </div>
        </div>
      </main>
    );
  }
  const visibleWorks = prioritizeMarketplaceCatalogSales(
    (works ?? []).filter(
      (work) =>
        !saleOnly || hasActiveMarketplaceCatalogProduct(work.digital_products),
    ),
  );
  let creatorRows: PublicWorkCreatorAttribution[] | null = null;
  if (visibleWorks.length) {
    const result = await supabase.rpc(
      "list_public_work_creator_attributions",
      { p_work_ids: visibleWorks.map((work) => work.id) },
    );
    creatorRows = result.data as PublicWorkCreatorAttribution[] | null;
  }
  const creatorByWork = mapPublicWorkCreatorAttributions(creatorRows);
  const tags = Array.from(
    new Set((tagRows ?? []).flatMap((row) => row.tags ?? [])),
  ).sort((a, b) => a.localeCompare(b, "ja"));
  const filtering = Boolean(keyword || selectedTag || saleOnly);

  return (
    <main className="marketplace-page">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-bold text-violet-700">MANGAI STORE</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            漫画を探す
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-600">
            まだ知らない物語と出会える、インディーズ漫画のデジタル書店です。
          </p>
        </div>

        <MarketplaceSearchFilters
          keyword={keyword}
          saleOnly={saleOnly}
          selectedTag={selectedTag}
          tags={tags}
        />

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-stone-600">
            {visibleWorks.length}件の作品
          </p>
          {filtering ? (
            <Link
              className="rounded-md text-sm font-bold text-violet-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              href="/works"
            >
              条件をクリア
            </Link>
          ) : null}
        </div>

        {visibleWorks.length ? (
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
            {visibleWorks.map((work) => {
              const sale = summarizeMarketplaceCatalogSale(
                work.digital_products,
                checkout,
              );
              return (
                <MarketplaceWorkCard
                  creatorName={creatorByWork.get(work.id) ?? "クリエイター"}
                  key={work.id}
                  sale={sale}
                  work={work}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              title={
                filtering
                  ? "条件に一致する作品がありません"
                  : "公開作品はまだありません"
              }
              body={
                saleOnly
                  ? "検索条件を変えるか、販売中のみを解除してお試しください。"
                  : filtering
                    ? "検索語やタグを変えてお試しください。"
                    : "最初の作品が公開されると、ここに表示されます。"
              }
            />
          </div>
        )}
      </div>
    </main>
  );
}
