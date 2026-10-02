import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";

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

export function MarketplaceSearchFilters({
  keyword,
  saleOnly,
  selectedTag,
  tags,
}: {
  keyword: string;
  saleOnly: boolean;
  selectedTag: string;
  tags: string[];
}) {
  return (
    <section aria-labelledby="marketplace-search-heading" className="mt-7">
      <h2 className="sr-only" id="marketplace-search-heading">
        漫画を検索・絞り込み
      </h2>
      <form action="/works" method="get" role="search">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">タイトルやあらすじから漫画を検索</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400"
            />
            <input
              className="h-12 w-full rounded-xl border border-stone-300 bg-white pl-11 pr-4 text-base outline-none transition placeholder:text-stone-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              defaultValue={keyword}
              maxLength={100}
              name="q"
              placeholder="タイトルやあらすじから探す"
              type="search"
            />
          </label>
          {selectedTag ? (
            <input name="tag" type="hidden" value={selectedTag} />
          ) : null}
          {saleOnly ? (
            <input name="sale" type="hidden" value="active" />
          ) : null}
          <button
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-violet-700 px-5 text-sm font-bold text-white transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            type="submit"
          >
            検索
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-col gap-3 border-b border-stone-200 pb-5 sm:flex-row sm:items-start">
        <div className="flex shrink-0 items-center gap-2 pt-1 text-sm font-bold text-stone-700">
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
          ジャンル・タグ
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            aria-current={!selectedTag ? "page" : undefined}
            className={`marketplace-filter-chip ${
              !selectedTag ? "marketplace-filter-chip-active" : ""
            }`}
            href={worksHref({ keyword, saleOnly, selectedTag: "" })}
          >
            すべて
          </Link>
          {tags.map((tag) => (
            <Link
              aria-current={selectedTag === tag ? "page" : undefined}
              className={`marketplace-filter-chip ${
                selectedTag === tag ? "marketplace-filter-chip-active" : ""
              }`}
              href={worksHref({ keyword, saleOnly, selectedTag: tag })}
              key={tag}
            >
              {tag}
            </Link>
          ))}
          <Link
            aria-pressed={saleOnly}
            className={`marketplace-filter-chip ${
              saleOnly ? "marketplace-filter-chip-active" : ""
            }`}
            href={worksHref({
              keyword,
              saleOnly: !saleOnly,
              selectedTag,
            })}
            role="button"
          >
            {saleOnly ? "販売中のみ ✓" : "販売中のみ"}
          </Link>
        </div>
      </div>
    </section>
  );
}
