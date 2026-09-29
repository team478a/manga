import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { WorkCard } from "@/components/WorkCard";
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

function worksHref({
  keyword,
  selectedTag,
  saleOnly,
}: {
  keyword: string;
  selectedTag: string;
  saleOnly: boolean;
}) {
  const query = new URLSearchParams();
  if (keyword) query.set("q", keyword);
  if (selectedTag) query.set("tag", selectedTag);
  if (saleOnly) query.set("sale", "active");
  const suffix = query.toString();
  return suffix ? `/works?${suffix}` : "/works";
}

export default async function WorksPage({
  searchParams,
}: {
  searchParams: Promise<WorksSearchParams>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="page">
        <EmptyState
          title="Supabase設定が必要です"
          body=".env.local を設定すると、公開作品一覧が表示されます。"
        />
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

  const [{ data: works }, { data: tagRows }] = await Promise.all([
    worksQuery.returns<PublicCatalogWork[]>(),
    supabase
      .from("works")
      .select("tags")
      .eq("is_public", true)
      .eq("content_class", "general")
      .returns<Array<{ tags: string[] | null }>>(),
  ]);
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
    <main className="page">
      <h1 className="text-3xl font-bold">公開作品</h1>
      <p className="mt-3 text-lg text-stone-600">
        クリエイターが公開した作品を検索できます。
      </p>

      <form className="panel mt-7" action="/works" method="get">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label>
            <span className="label">作品を検索</span>
            <input
              className="field"
              name="q"
              defaultValue={keyword}
              placeholder="タイトルや説明を入力"
              maxLength={100}
            />
          </label>
          {selectedTag ? (
            <input type="hidden" name="tag" value={selectedTag} />
          ) : null}
          {saleOnly ? (
            <input type="hidden" name="sale" value="active" />
          ) : null}
          <button className="button" type="submit">
            検索する
          </button>
        </div>
        {tags.length ? (
          <div className="mt-5">
            <p className="label">タグで絞り込む</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                className={`rounded-full px-3 py-2 text-sm ${!selectedTag ? "bg-leaf text-white" : "bg-linen text-stone-700"}`}
                href={worksHref({ keyword, selectedTag: "", saleOnly })}
              >
                すべて
              </Link>
              {tags.map((tag) => {
                const query = new URLSearchParams();
                if (keyword) query.set("q", keyword);
                query.set("tag", tag);
                if (saleOnly) query.set("sale", "active");
                return (
                  <Link
                    className={`rounded-full px-3 py-2 text-sm ${selectedTag === tag ? "bg-leaf text-white" : "bg-linen text-stone-700"}`}
                    href={`/works?${query}`}
                    key={tag}
                  >
                    {tag}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="mt-5 border-t border-stone-100 pt-5">
          <Link
            className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${saleOnly ? "bg-violet-700 text-white" : "bg-violet-50 text-violet-800"}`}
            href={worksHref({
              keyword,
              selectedTag,
              saleOnly: !saleOnly,
            })}
          >
            {saleOnly ? "販売中のみを解除" : "販売中の作品だけを見る"}
          </Link>
        </div>
      </form>

      <div className="mt-7 flex items-center justify-between gap-4">
        <p className="text-stone-600">{visibleWorks.length}件の作品</p>
        {filtering ? (
          <Link
            className="font-semibold text-leaf hover:underline"
            href="/works"
          >
            条件をクリア
          </Link>
        ) : null}
      </div>

      {visibleWorks.length ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleWorks.map((work) => {
            const sale = summarizeMarketplaceCatalogSale(
              work.digital_products,
              checkout,
            );
            return (
              <WorkCard
                key={work.id}
                work={work}
                sale={sale}
                creatorName={creatorByWork.get(work.id) ?? "クリエイター"}
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
    </main>
  );
}
