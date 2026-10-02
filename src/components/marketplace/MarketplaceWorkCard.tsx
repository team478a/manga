import Link from "next/link";
import { MarketplaceCover } from "./MarketplaceCover";
import {
  MarketplaceFavoriteButton,
  type MarketplaceFavoriteControl,
} from "./MarketplaceFavoriteButton";
import { yen } from "@/lib/format";
import type { MarketplaceCatalogSale } from "@/lib/marketplace-catalog";
import type { Work } from "@/lib/types";

export function MarketplaceWorkCard({
  work,
  sale,
  creatorName,
  favoriteControl,
}: {
  work: Work;
  sale: MarketplaceCatalogSale | null;
  creatorName: string;
  favoriteControl?: MarketplaceFavoriteControl;
}) {
  return (
    <article className="group relative min-w-0">
      <Link
        className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-4"
        href={`/works/${work.id}`}
      >
        <div className="relative transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none">
          <MarketplaceCover
            className="shadow-sm"
            imageUrl={work.image_url}
            sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"
            title={work.title}
          />
          {sale ? (
            <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-violet-800 shadow-sm">
              {sale.label}
            </span>
          ) : null}
        </div>

        <div className="pt-3">
          <h2 className="line-clamp-2 text-sm font-bold leading-snug text-stone-900 sm:text-base">
            {work.title}
          </h2>
          <p className="mt-1 truncate text-xs text-stone-500 sm:text-sm">
            {creatorName}
          </p>
          <div className="mt-2 flex min-h-6 items-center justify-between gap-2">
            {sale ? (
              <p className="text-sm font-black text-stone-900 sm:text-base">
                {yen(sale.lowestPrice)}
                <span className="ml-0.5 text-[11px] font-semibold text-stone-500">
                  円{sale.productCount > 1 ? "〜" : ""}
                </span>
              </p>
            ) : (
              <p className="text-xs font-semibold text-stone-500">作品を読む</p>
            )}
            {work.tags?.[0] ? (
              <span className="max-w-[45%] truncate rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold text-stone-600">
                {work.tags[0]}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      {favoriteControl ? (
        <div className="absolute right-2 top-2 z-10">
          <MarketplaceFavoriteButton
            control={favoriteControl}
            workId={work.id}
          />
        </div>
      ) : null}
    </article>
  );
}
