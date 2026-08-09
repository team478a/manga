import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { yen } from "@/lib/format";
import { listPurchaseHistoryForProfile } from "@/modules/purchases/infrastructure/purchase-query-repository";

export default async function PurchasesPage() {
  const { profile } = await requireProfile();
  const { data } = await listPurchaseHistoryForProfile(profile.id);
  const purchases = data ?? [];
  return (
    <main className="page max-w-5xl">
      <Link className="text-leaf underline" href="/dashboard">
        ← マイページ
      </Link>
      <h1 className="mt-4 text-3xl font-bold">購入履歴</h1>
      <p className="mt-2 text-stone-600">
        支払済み商品は、本人確認後に5分間有効なURLを再発行します。
      </p>
      <section className="mt-6 space-y-4">
        {purchases.length ? (
          purchases.map((purchase) => (
            <article className="panel p-5" key={purchase.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {purchase.digital_products?.title ?? "販売終了商品"}
                  </h2>
                  <p className="mt-1 text-stone-600">
                    {purchase.digital_products?.works?.title ?? "作品"}・{yen(purchase.amount)}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    {purchase.paid_at
                      ? new Date(purchase.paid_at).toLocaleString("ja-JP")
                      : "決済日時確認中"}・ダウンロード {purchase.download_count}回
                  </p>
                </div>
                {purchase.status === "paid" &&
                purchase.digital_products?.file_url ? (
                  <a
                    className="button"
                    href={`/api/purchases/${purchase.id}/download`}
                  >
                    ダウンロード
                  </a>
                ) : (
                  <span className="rounded bg-stone-100 px-3 py-2 text-stone-600">
                    {purchase.status === "refunded" ? "返金済み" : "利用不可"}
                  </span>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="panel p-6 text-stone-600">購入履歴はありません。</div>
        )}
      </section>
    </main>
  );
}
