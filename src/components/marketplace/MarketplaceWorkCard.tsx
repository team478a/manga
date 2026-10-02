import Image from "next/image";
import Link from "next/link";
import { yen } from "@/lib/format";
import type { MarketplaceCatalogSale } from "@/lib/marketplace-catalog";
import type { Work } from "@/lib/types";

export function MarketplaceWorkCard({
  work,
  sale,
  creatorName,
}: {
  work: Work;
  sale: MarketplaceCatalogSale | null;
  creatorName: string;
}) {
  return (
    <article className="group min-w-0">
      <Link
        className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-4"
        href={`/works/${work.id}`}
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
          {work.image_url ? (
            <Image
              alt={`${work.title}の表紙`}
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
              fill
              sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"
              src={work.image_url}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-stone-100 px-3 text-center text-stone-500">
              <span className="text-xs font-bold tracking-widest text-violet-700">
                MANGAI
              </span>
              <span className="mt-3 text-sm font-semibold">表紙準備中</span>
            </div>
          )}
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
    </article>
  );
}
