import Link from "next/link";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { yen, statusLabel } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import { listAdminSalesOrders } from "@/modules/sales/infrastructure/admin-sales-query-repository";

export default async function AdminOrdersPage() {
  await requireAdmin();
  const { data, error } = await listAdminSalesOrders();
  const orders = data ?? [];
  const pageError = error
    ? "注文情報を読み込めませんでした。注文が0件になったわけではありません。時間をおいて再読み込みしてください。"
    : null;

  return (
    <main className="page">
      <h1 className="text-3xl font-bold">注文管理</h1>
      {pageError ? (
        <InlineErrorMessage role="alert">{pageError}</InlineErrorMessage>
      ) : null}
      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead><tr className="border-b"><th className="py-3">購入者</th><th>金額</th><th>手数料</th><th>作者受取</th><th>状態</th><th>区分</th></tr></thead>
          <tbody>
            {error ? (
              <tr>
                <td className="py-5 text-stone-600" colSpan={6}>
                  <p>注文一覧を空として扱わず、読込を停止しました。</p>
                  <Link className="button-secondary mt-4" href="/admin/orders">
                    注文情報を再読み込み
                  </Link>
                </td>
              </tr>
            ) : orders.length ? orders.map((order) => (
              <tr className="border-b border-stone-100" key={order.id}>
                <td className="py-3">{order.buyer_email}</td>
                <td>{yen(order.amount)}</td>
                <td>{yen(order.platform_fee)}</td>
                <td>{yen(order.creator_revenue)}</td>
                <td>{statusLabel(order.status)}</td>
                <td>{order.payment_mode === "test" ? "テスト" : "本番"}</td>
              </tr>
            )) : (
              <tr><td className="py-5 text-stone-600" colSpan={6}>注文はまだありません。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
