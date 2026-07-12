import Image from "next/image";
import Link from "next/link";
import type { Work } from "@/lib/types";

export function WorkCard({ work, editable = false }: { work: Work; editable?: boolean }) {
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
          <p className="mt-2 line-clamp-2 text-base text-stone-600">{work.description || "説明はまだありません。"}</p>
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
