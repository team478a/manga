import Link from "next/link";
import { notFound } from "next/navigation";
import { getReadableWorkPublication } from "@/modules/publication/application/work-publication-service";

export default async function WorkReaderPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const requested = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const publication = await getReadableWorkPublication(id, requested).catch(() => null);
  if (!publication) notFound();
  const index = publication.accessiblePages.indexOf(publication.pageNumber);
  const previous = publication.accessiblePages[index - 1];
  const next = publication.accessiblePages[index + 1];
  return (
    <main className="page max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link className="text-leaf underline" href={`/works/${id}`}>← 作品ページへ</Link>
          <h1 className="mt-3 text-3xl font-bold">{publication.workTitle}</h1>
          <p className="mt-2 text-stone-600">公開版 v{publication.publicationVersion}・{publication.pageNumber}/{publication.pageCount}ページ</p>
        </div>
        {!publication.fullAccess ? <p className="rounded-md bg-amber-50 px-4 py-2 text-amber-900">サンプルページを表示中です。購入後は全ページを読めます。</p> : null}
      </div>
      <div className="mt-6 flex justify-center overflow-auto rounded-lg bg-stone-900 p-2 sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={`${publication.workTitle} ${publication.pageNumber}ページ`} className="h-auto max-h-[85vh] max-w-full object-contain" src={publication.imageUrl} />
      </div>
      <nav aria-label="本文ページ" className="mt-5 flex items-center justify-between gap-3">
        {previous ? <Link className="button-secondary" href={`/works/${id}/read?page=${previous}`}>前のページ</Link> : <span />}
        <span className="font-semibold">{publication.pageNumber} / {publication.pageCount}</span>
        {next ? <Link className="button-secondary" href={`/works/${id}/read?page=${next}`}>次のページ</Link> : <span />}
      </nav>
    </main>
  );
}
