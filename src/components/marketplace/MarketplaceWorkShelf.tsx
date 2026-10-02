import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketplaceWorkCard } from "./MarketplaceWorkCard";
import type { MarketplaceCatalogSale } from "@/lib/marketplace-catalog";
import type { MarketplaceHomeWork } from "@/lib/marketplace-home";

export function MarketplaceWorkShelf({
  title,
  description,
  works,
  creatorByWork,
  saleByWork,
  linkHref = "/works",
  linkLabel = "すべて見る",
}: {
  title: string;
  description: string;
  works: MarketplaceHomeWork[];
  creatorByWork: Map<string, string>;
  saleByWork: Map<string, MarketplaceCatalogSale | null>;
  linkHref?: string;
  linkLabel?: string;
}) {
  if (!works.length) return null;

  return (
    <section aria-labelledby={`shelf-${title}`} className="py-9 sm:py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2
            className="text-2xl font-black tracking-tight text-stone-900 sm:text-3xl"
            id={`shelf-${title}`}
          >
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600 sm:text-base">
            {description}
          </p>
        </div>
        <Link
          className="hidden shrink-0 items-center gap-1 rounded-md text-sm font-bold text-violet-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 sm:inline-flex"
          href={linkHref}
        >
          {linkLabel}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
        {works.map((work) => (
          <MarketplaceWorkCard
            creatorName={creatorByWork.get(work.id) ?? "クリエイター"}
            key={work.id}
            sale={saleByWork.get(work.id) ?? null}
            work={work}
          />
        ))}
      </div>

      <Link
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-stone-300 bg-white px-4 text-sm font-bold text-stone-800 outline-none hover:border-violet-300 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 sm:hidden"
        href={linkHref}
      >
        {linkLabel}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </section>
  );
}
