import Link from "next/link";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { requireProfile } from "@/lib/auth";
import { yen } from "@/lib/format";
import { purchaseDownloadFailureMessage } from "@/lib/purchase-download-feedback";
import { listPurchaseHistoryForProfile } from "@/modules/purchases/infrastructure/purchase-query-repository";

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ download_error?: string }>;
}) {
  const params = await searchParams;
  const { profile } = await requireProfile();
  const { data, error } = await listPurchaseHistoryForProfile(profile.id);
  const purchases = data ?? [];
  const pageError = error
    ? "購入履歴を読み込めませんでした。購入情報は削除されていません。時間をおいて再読み込みしてください。"
    : purchaseDownloadFailureMessage(params.download_error);
  return (
    <main className="page max-w-5xl">
      <Link className="text-leaf underline" href="/dashboard">
        ← マイページ
      </Link>
      <h1 className="mt-4 text-3xl font-bold">購入履歴</h1>
      <p className="mt-2 text-stone-600">
        支払済み商品は、本人確認後に5分間有効なURLを再発行します。
        テスト購入には「テスト購入」と表示され、実際の請求・売上・振込は発生しません。
      </p>
      {pageError ? (
        <InlineErrorMessage role="alert">{pageError}</InlineErrorMessage>
      ) : null}
      <section className="mt-6 space-y-4">
        {error ? (
          <div className="panel p-6">
            <p className="text-stone-600">
              購入履歴を空として扱わず、読込を停止しました。
            </p>
            <Link className="button-secondary mt-4" href="/dashboard/purchases">
              購入履歴を再読み込み
            </Link>
          </div>
        ) : purchases.length ? (
          purchases.map((purchase) => (
            <article className="panel p-5" key={purchase.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {purchase.digital_products?.title ?? "販売終了商品"}
                  </h2>
                  {purchase.payment_mode === "test" ? <span className="mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-900">テスト購入</span> : null}
                  <p className="mt-1 text-stone-600">
                    {purchase.digital_products?.works?.title ?? "作品"}・{yen(purchase.amount)}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    {purchase.paid_at
                      ? new Date(purchase.paid_at).toLocaleString("ja-JP")
                      : "決済日時確認中"}・ダウンロード {purchase.download_count}回
                  </p>
                </div>
                {purchase.status === "paid" ? (
                  <div className="flex flex-wrap gap-2">
                    {purchase.digital_products?.works?.id ? (
                      <Link className="button-secondary" href={`/works/${purchase.digital_products.works.id}/read`}>
                        本文を読む
                      </Link>
                    ) : null}
                    {purchase.digital_products?.file_url ? (
                      <a
                        className="button"
                        href={`/api/purchases/${purchase.id}/download`}
                      >
                        ダウンロード
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <span className="rounded bg-stone-100 px-3 py-2 text-stone-600">
                    {purchase.status === "refunded" ? "返金済み" : "利用不可"}
                  </span>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="panel p-6 text-stone-600">
            <p>購入履歴はありません。</p>
            <Link className="button-secondary mt-4" href="/works">
              公開作品を確認
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
