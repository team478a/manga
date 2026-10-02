export function MarketplaceLoadingState({
  title,
  cardCount = 6,
}: {
  title: string;
  cardCount?: number;
}) {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="marketplace-page"
      role="status"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm font-bold text-violet-700">MANGAI STORE</p>
        <h1 className="mt-2 text-2xl font-black text-stone-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          画面を移動せずにお待ちください。
        </p>

        <div
          aria-hidden="true"
          className="mt-7 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5"
        >
          {Array.from({ length: cardCount }, (_, index) => (
            <div className="min-w-0" key={index}>
              <div className="aspect-[2/3] animate-pulse rounded-lg bg-stone-200 motion-reduce:animate-none" />
              <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-stone-200 motion-reduce:animate-none" />
              <div className="mt-2 h-3 w-2/5 animate-pulse rounded bg-stone-200 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
