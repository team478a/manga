import Link from "next/link";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { yen, statusLabel } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import {
  listSalesOrdersForCreator,
  type SalesOrderRecord,
} from "@/modules/sales/infrastructure/sales-query-repository";

const orderDateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

const salesOrderFilters = [
  { value: "all", label: "すべて" },
  { value: "live", label: "本番" },
  { value: "test", label: "テスト" },
  { value: "pending", label: "受付済み" },
  { value: "paid", label: "支払い済み" },
  { value: "closed", label: "不成立・返金" },
] as const;

type SalesOrderFilter = (typeof salesOrderFilters)[number]["value"];

function resolveSalesOrderFilter(value: string | undefined): SalesOrderFilter {
  return salesOrderFilters.some((filter) => filter.value === value)
    ? (value as SalesOrderFilter)
    : "all";
}

function matchesSalesOrderFilter(
  order: SalesOrderRecord,
  filter: SalesOrderFilter,
) {
  if (filter === "live") return order.payment_mode === "live";
  if (filter === "test") return order.payment_mode === "test";
  if (filter === "pending") return order.status === "pending";
  if (filter === "paid") return order.status === "paid";
  if (filter === "closed")
    return ["failed", "refunded", "canceled"].includes(order.status);
  return true;
}

function OrderSourceLinks({ order }: { order: SalesOrderRecord }) {
  return (
    <>
      {order.digital_products?.works ? (
        <Link
          className="block font-semibold text-leaf underline"
          href={`/dashboard/works/${order.digital_products.works.id}/edit`}
        >
          {order.digital_products.works.title}
        </Link>
      ) : (
        <span className="block font-semibold">作品情報なし</span>
      )}
      {order.digital_products ? (
        <Link
          className="mt-1 block text-sm text-leaf underline"
          href={`/dashboard/products/${order.digital_products.id}/edit`}
        >
          {order.digital_products.title}
        </Link>
      ) : (
        <span className="mt-1 block text-sm text-stone-600">商品情報なし</span>
      )}
    </>
  );
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const activeFilter = resolveSalesOrderFilter(params.filter);
  const { profile } = await requireProfile();
  const { data, error } = await listSalesOrdersForCreator(profile.id);
  const orders = data ?? [];
  const filteredOrders = error
    ? []
    : orders.filter((order) => matchesSalesOrderFilter(order, activeFilter));
  const pageError = error
    ? "注文・売上情報を読み込めませんでした。売上や注文が0件になったわけではありません。時間をおいて再読み込みしてください。"
    : null;

  const paidLiveOrders = error
    ? null
    : orders.filter(
        (order) => order.status === "paid" && order.payment_mode === "live",
      );
  const salesSummary = paidLiveOrders
    ? paidLiveOrders.reduce(
        (summary, order) => ({
          completedOrderCount: summary.completedOrderCount + 1,
          grossSales: summary.grossSales + order.amount,
          platformFees: summary.platformFees + order.platform_fee,
          creatorRevenue: summary.creatorRevenue + order.creator_revenue,
        }),
        {
          completedOrderCount: 0,
          grossSales: 0,
          platformFees: 0,
          creatorRevenue: 0,
        },
      )
    : null;
  const orderStatusSummary = error
    ? null
    : {
        pending: orders.filter((order) => order.status === "pending").length,
        paid: orders.filter((order) => order.status === "paid").length,
        closed: orders.filter((order) =>
          ["failed", "refunded", "canceled"].includes(order.status),
        ).length,
      };

  return (
    <main className="page">
      <Link className="text-leaf underline" href="/dashboard">
        ← マイページ
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">売上管理</h1>
          <p className="mt-2 text-stone-600">
            指定購入者が購入手続きを完了すると、注文と売上の状態がここに表示されます。
          </p>
        </div>
        <Link className="button-secondary w-fit" href="/dashboard/sales">
          注文・売上情報を再読み込み
        </Link>
      </div>
      <div className="panel mt-6">
        <p className="text-lg text-stone-600">クリエイター受取予定額（参考）</p>
        <p className="mt-2 text-4xl font-bold">
          {salesSummary === null
            ? "確認できません"
            : yen(salesSummary.creatorRevenue)}
        </p>
        <dl
          aria-label="支払い済み本番注文の売上内訳"
          className="mt-5 grid gap-3 sm:grid-cols-3"
        >
          <div className="rounded-xl bg-stone-50 p-4">
            <dt className="text-sm text-stone-600">購入完了</dt>
            <dd className="mt-1 text-xl font-bold">
              {salesSummary === null
                ? "確認できません"
                : `${salesSummary.completedOrderCount}件`}
            </dd>
          </div>
          <div className="rounded-xl bg-stone-50 p-4">
            <dt className="text-sm text-stone-600">販売金額</dt>
            <dd className="mt-1 text-xl font-bold">
              {salesSummary === null
                ? "確認できません"
                : yen(salesSummary.grossSales)}
            </dd>
          </div>
          <div className="rounded-xl bg-stone-50 p-4">
            <dt className="text-sm text-stone-600">手数料</dt>
            <dd className="mt-1 text-xl font-bold">
              {salesSummary === null
                ? "確認できません"
                : yen(salesSummary.platformFees)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-stone-600">
          この内訳は注文一覧の絞り込みにかかわらず、支払い済みの本番注文だけを集計します。
        </p>
        <div
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950"
          role="note"
        >
          <p>
            支払い済みの本番注文だけを合計した参考値です。現在、MANGAIからの振込・精算確定は利用できません。
          </p>
          <p className="mt-2">
            テスト購入は受取予定額に含みません。実際の請求・売上・振込も発生しません。
          </p>
          <Link
            className="mt-3 inline-block font-semibold underline"
            href="/dashboard/monitor/guide#internal-test-sale"
          >
            限定テスト販売と収益管理の案内
          </Link>
        </div>
      </div>
      {pageError ? (
        <InlineErrorMessage role="alert">{pageError}</InlineErrorMessage>
      ) : null}
      <section className="panel mt-6">
        <h2 className="text-2xl font-bold">注文一覧</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          「受付済み」は決済確認前、「支払い済み」は購入完了です。失敗・キャンセル・返金済みの注文は受取予定額に含みません。日時は日本時間で表示します。
          作品名・商品名から、所有する設定画面へ戻れます。
        </p>
        <div className="mt-5">
          <h3 className="text-lg font-bold">注文状態</h3>
          <p className="mt-1 text-sm leading-relaxed text-stone-600">
            状態別件数はテストと本番を合算します。上の売上内訳は支払い済みの本番注文だけが対象です。
          </p>
          {orderStatusSummary === null ? (
            <p className="mt-3 text-sm font-semibold text-stone-700">
              状態別件数を確認できません。
            </p>
          ) : (
            <dl
              aria-label="注文状態別の件数"
              className="mt-3 grid gap-3 sm:grid-cols-3"
            >
              <div className="rounded-xl bg-stone-50 p-4">
                <dt className="text-sm text-stone-600">受付済み</dt>
                <dd className="mt-1 text-xl font-bold">
                  {orderStatusSummary.pending}件
                </dd>
              </div>
              <div className="rounded-xl bg-stone-50 p-4">
                <dt className="text-sm text-stone-600">支払い済み</dt>
                <dd className="mt-1 text-xl font-bold">
                  {orderStatusSummary.paid}件
                </dd>
              </div>
              <div className="rounded-xl bg-stone-50 p-4">
                <dt className="text-sm text-stone-600">不成立・返金</dt>
                <dd className="mt-1 text-xl font-bold">
                  {orderStatusSummary.closed}件
                </dd>
              </div>
            </dl>
          )}
        </div>
        {!error && orders.length ? (
          <div className="mt-5">
            <nav aria-label="注文の絞り込み" className="flex flex-wrap gap-2">
              {salesOrderFilters.map((filter) => {
                const isActive = filter.value === activeFilter;
                const href =
                  filter.value === "all"
                    ? "/dashboard/sales"
                    : `/dashboard/sales?filter=${filter.value}`;
                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={isActive ? "button" : "button-secondary"}
                    href={href}
                    key={filter.value}
                  >
                    {filter.label}
                  </Link>
                );
              })}
            </nav>
            <p className="mt-3 text-sm text-stone-600" role="status">
              {orders.length}件中 {filteredOrders.length}件を表示
            </p>
          </div>
        ) : null}
        {error ? (
          <div className="mt-5 text-stone-600">
            <p>注文一覧を空として扱わず、読込を停止しました。</p>
            <Link className="button-secondary mt-4" href="/dashboard/sales">
              注文・売上情報を再読み込み
            </Link>
          </div>
        ) : filteredOrders.length ? (
          <>
            <div
              className="mt-5 space-y-4 md:hidden"
              aria-label="スマートフォン向け注文一覧"
            >
              {filteredOrders.map((order) => (
                <article
                  className="rounded-2xl border border-stone-200 p-4"
                  key={order.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <time
                      className="text-sm text-stone-600"
                      dateTime={order.created_at}
                    >
                      {orderDateTimeFormatter.format(
                        new Date(order.created_at),
                      )}
                    </time>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">
                      {order.payment_mode === "test" ? "テスト" : "本番"}
                    </span>
                  </div>
                  <div className="mt-3">
                    <OrderSourceLinks order={order} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div className="col-span-2">
                      <dt className="text-stone-500">購入者</dt>
                      <dd className="mt-1 break-all text-stone-900">
                        {order.buyer_email}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">状態</dt>
                      <dd className="mt-1 font-semibold text-stone-900">
                        {statusLabel(order.status)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">販売金額</dt>
                      <dd className="mt-1 text-stone-900">
                        {yen(order.amount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">手数料</dt>
                      <dd className="mt-1 text-stone-900">
                        {yen(order.platform_fee)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">受取</dt>
                      <dd className="mt-1 font-semibold text-stone-900">
                        {yen(order.creator_revenue)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            <div className="mt-5 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-base">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="py-3">受付日時</th>
                    <th className="py-3">購入者</th>
                    <th className="py-3">作品・商品</th>
                    <th className="py-3">金額</th>
                    <th className="py-3">手数料</th>
                    <th className="py-3">受取</th>
                    <th className="py-3">状態</th>
                    <th className="py-3">区分</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr className="border-b border-stone-100" key={order.id}>
                      <td className="py-3 pr-4">
                        <time dateTime={order.created_at}>
                          {orderDateTimeFormatter.format(
                            new Date(order.created_at),
                          )}
                        </time>
                      </td>
                      <td className="py-3">{order.buyer_email}</td>
                      <td className="py-3">
                        <OrderSourceLinks order={order} />
                      </td>
                      <td className="py-3">{yen(order.amount)}</td>
                      <td className="py-3">{yen(order.platform_fee)}</td>
                      <td className="py-3 font-semibold">
                        {yen(order.creator_revenue)}
                      </td>
                      <td className="py-3">{statusLabel(order.status)}</td>
                      <td className="py-3">
                        {order.payment_mode === "test" ? "テスト" : "本番"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : orders.length ? (
          <div className="mt-5 text-stone-600">
            <p className="font-semibold text-stone-900">
              選択した条件に一致する注文はありません。
            </p>
            <Link className="button-secondary mt-4" href="/dashboard/sales">
              すべての注文を表示
            </Link>
          </div>
        ) : (
          <div className="mt-5 text-stone-600">
            <p className="font-semibold text-stone-900">
              注文はまだありません。
            </p>
            <p className="mt-2 max-w-3xl leading-relaxed">
              販売中の作品から購入準備URLを案内し、管理者が確認した指定購入者・期間内で購入手続きが完了すると反映されます。画面を開いたままでは自動更新されないため、購入者から完了連絡を受けた後に再読み込みしてください。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="button-secondary" href="/creator">
                販売中の作品を確認
              </Link>
              <Link
                className="button-secondary"
                href="/dashboard/monitor/guide#internal-test-sale"
              >
                テスト販売の手順
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
