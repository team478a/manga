import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Download,
  LibraryBig,
  RefreshCw,
  Search,
} from "lucide-react";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { MarketplaceCover } from "@/components/marketplace/MarketplaceCover";
import { requireProfile } from "@/lib/auth";
import { yen } from "@/lib/format";
import {
  loadMarketplaceReadingProgress,
  marketplaceReadingProgressKey,
} from "@/lib/marketplace-reading-progress";
import { purchaseDownloadFailureMessage } from "@/lib/purchase-download-feedback";
import { listPurchaseHistoryForProfile } from "@/modules/purchases/infrastructure/purchase-query-repository";

function purchaseDateLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "購入日時確認中";
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ download_error?: string }>;
}) {
  const params = await searchParams;
  const { profile } = await requireProfile();
  const { data, error } = await listPurchaseHistoryForProfile(profile.id);
  const purchases = data ?? [];
  const workIds = purchases.flatMap((purchase) => {
    const workId = purchase.digital_products?.works?.id;
    return workId ? [workId] : [];
  });
  const progress = await loadMarketplaceReadingProgress(profile.id, workIds);
  const pageError = error
    ? "購入履歴を読み込めませんでした。購入情報は削除されていません。時間をおいて再読み込みしてください。"
    : purchaseDownloadFailureMessage(params.download_error);

  return (
    <main className="marketplace-page">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        <Link
          className="inline-flex min-h-10 items-center gap-1 rounded-md text-sm font-bold text-stone-600 outline-none hover:text-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          href="/dashboard"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          マイページへ戻る
        </Link>

        <header className="mt-4 border-b border-stone-200 pb-7 sm:flex sm:items-end sm:justify-between sm:gap-6">
          <div>
            <p className="text-xs font-black tracking-[0.18em] text-violet-700">
              MY BOOKSHELF
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
              本棚
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-stone-600">
              購入した漫画を読んだり、デジタル版をダウンロードしたりできます。
            </p>
          </div>
          {!error && purchases.length ? (
            <p className="mt-4 text-sm font-bold text-stone-500 sm:mt-0">
              {purchases.length}冊の本
            </p>
          ) : null}
        </header>

        <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-950 sm:px-5">
          支払済み商品は、本人確認後に5分間有効なURLを再発行します。
          テスト購入には「テスト購入」と表示され、実際の請求・売上・振込は発生しません。
        </div>

        {pageError ? (
          <InlineErrorMessage role="alert">{pageError}</InlineErrorMessage>
        ) : null}

        <section aria-label="購入した漫画" className="mt-7">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="font-bold text-stone-900">
                購入履歴を空として扱わず、読込を停止しました。
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                購入情報は保持されています。時間をおいてから再読み込みしてください。
              </p>
              <Link
                className="mt-5 inline-flex min-h-12 items-center justify-center rounded-lg border border-stone-300 bg-white px-5 font-bold text-stone-900 outline-none transition hover:border-violet-300 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                href="/dashboard/purchases"
              >
                <RefreshCw aria-hidden="true" className="mr-2 h-5 w-5" />
                購入履歴を再読み込み
              </Link>
            </div>
          ) : purchases.length ? (
            <div className="grid gap-5 md:grid-cols-2">
              {purchases.map((purchase) => {
                const product = purchase.digital_products;
                const work = product?.works;
                const canRead = purchase.status === "paid" && Boolean(work?.id);
                const canDownload =
                  purchase.status === "paid" &&
                  Boolean(purchase.digital_products?.file_url);
                const fixedPublicationId =
                  purchase.publication_id ?? work?.current_publication_id ?? null;
                const savedPage = fixedPublicationId
                  ? progress.pagesByPublication.get(
                      marketplaceReadingProgressKey(
                        work!.id,
                        fixedPublicationId,
                      ),
                    )
                  : undefined;
                const publicationQuery = fixedPublicationId
                  ? `publication=${fixedPublicationId}`
                  : "";
                const readerHref = savedPage
                  ? `/works/${work!.id}/read?${publicationQuery}&page=${savedPage}`
                  : publicationQuery
                    ? `/works/${work!.id}/read?${publicationQuery}`
                    : `/works/${work!.id}/read`;

                return (
                  <article
                    className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
                    key={purchase.id}
                  >
                    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-5 sm:p-5">
                      <MarketplaceCover
                        className="shadow-sm"
                        imageUrl={work?.image_url}
                        sizes="132px"
                        title={work?.title ?? "作品"}
                      />

                      <div className="min-w-0 py-1">
                        <div className="flex flex-wrap gap-2">
                          {purchase.payment_mode === "test" ? (
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-900">
                              テスト購入
                            </span>
                          ) : null}
                          {purchase.status === "refunded" ? (
                            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">
                              返金済み
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-2 line-clamp-3 text-lg font-black leading-snug text-stone-950 sm:text-xl">
                          {work?.title ?? "作品情報を確認中"}
                        </h2>
                        <p className="mt-2 truncate text-sm font-semibold text-stone-600">
                          {product?.profiles?.display_name?.trim() || "クリエイター"}
                        </p>
                        <p className="mt-3 text-xs leading-5 text-stone-500">
                          {purchaseDateLabel(purchase.paid_at)}
                          <br />
                          {product?.title ?? "デジタル版"}・{yen(purchase.amount)}円
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-stone-200 bg-stone-50 p-4 sm:px-5">
                      {purchase.status === "paid" ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          {canRead ? (
                            <Link
                              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-violet-700 px-4 font-bold text-white outline-none transition hover:bg-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                              href={readerHref}
                            >
                              <BookOpen aria-hidden="true" className="mr-2 h-5 w-5" />
                              {savedPage && savedPage > 1
                                ? `続きから読む（${savedPage}ページ）`
                                : "漫画を読む"}
                            </Link>
                          ) : null}
                          {canDownload ? (
                            <a
                              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg border border-stone-300 bg-white px-4 font-bold text-stone-900 outline-none transition hover:border-violet-300 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                              href={`/api/purchases/${purchase.id}/download`}
                            >
                              <Download aria-hidden="true" className="mr-2 h-5 w-5" />
                              Download
                            </a>
                          ) : null}
                          {!canRead && !canDownload ? (
                            <p className="text-sm leading-6 text-stone-600">
                              購入済みコンテンツを準備しています。
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm font-semibold text-stone-600">
                          この購入は返金済みのため利用できません。
                        </p>
                      )}
                      {canDownload ? (
                        <p className="mt-2 text-xs text-stone-500">
                          ダウンロード {purchase.download_count}回
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center shadow-sm sm:py-16">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                <LibraryBig aria-hidden="true" className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-xl font-black text-stone-900">
                本棚はまだ空です。
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
                気になる漫画を探して、試し読みから始めてみましょう。
              </p>
              <Link
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-violet-700 px-5 font-bold text-white outline-none transition hover:bg-violet-800 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                href="/works"
              >
                <Search aria-hidden="true" className="mr-2 h-5 w-5" />
                公開作品を確認
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
