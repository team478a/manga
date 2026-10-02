import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function MarketplaceInlineError({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <section
      className="rounded-2xl border border-red-200 bg-white px-5 py-8 text-center shadow-sm sm:px-8"
      role="alert"
    >
      <AlertTriangle
        aria-hidden="true"
        className="mx-auto h-8 w-8 text-red-600"
      />
      <h2 className="mt-3 text-xl font-black text-stone-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">
        {description}
      </p>
      <Link
        className="mt-5 inline-flex min-h-12 items-center justify-center rounded-lg bg-violet-700 px-5 font-bold text-white outline-none transition hover:bg-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        href={href}
      >
        もう一度読み込む
      </Link>
    </section>
  );
}
