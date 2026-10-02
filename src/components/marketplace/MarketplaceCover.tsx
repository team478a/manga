import Image from "next/image";

export function MarketplaceCover({
  imageUrl,
  priority = false,
  sizes,
  title,
  className = "",
}: {
  imageUrl: string | null | undefined;
  priority?: boolean;
  sizes: string;
  title: string;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-lg border border-stone-200 bg-stone-100 ${className}`}
    >
      {imageUrl ? (
        <Image
          alt={`${title}の表紙`}
          className="object-contain"
          fill
          priority={priority}
          sizes={sizes}
          src={imageUrl}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-stone-100 px-3 text-center text-stone-500">
          <span className="text-xs font-black tracking-[0.18em] text-violet-700">
            MANGAI
          </span>
          <span className="mt-3 text-sm font-bold">表紙準備中</span>
        </div>
      )}
    </div>
  );
}
