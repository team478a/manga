import Image from "next/image";
import Link from "next/link";
import { yen } from "@/lib/format";
import type { MarketplaceCatalogSale } from "@/lib/marketplace-catalog";
import type { Work } from "@/lib/types";

export function WorkCard({
  work,
  editable = false,
  sale = null,
  creatorName = null,
}: {
  work: Work;
  editable?: boolean;
  sale?: MarketplaceCatalogSale | null;
  creatorName?: string | null;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-soft">
      <Link href={editable ? `/dashboard/works/${work.id}/edit` : `/works/${work.id}`}>
        <div className="relative aspect-[4/3] bg-linen">
          {work.image_url ? (
            <Image src={work.image_url} alt={work.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
          ) : (
            <div className="flex h-full items-center justify-center text-stone-500">画像未登録</div>
          )}
        </div>
        <div className="p-5">
          <h3 className="text-xl font-bold">{work.title}</h3>
          {creatorName ? (
            <p className="mt-2 text-sm font-semibold text-stone-500">
              作：{creatorName}
            </p>
          ) : null}
          <p className="mt-2 line-clamp-2 text-base text-stone-600">{work.description || "説明はまだありません。"}</p>
          {sale ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
              <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-800">
                {sale.label}
              </span>
              <span className="font-bold text-stone-900">
                税込 {yen(sale.lowestPrice)}
                {sale.productCount > 1 ? "から" : ""}
              </span>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {work.tags?.slice(0, 3).map((tag) => (
              <span className="rounded-full bg-linen px-3 py-1 text-sm text-stone-700" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}
