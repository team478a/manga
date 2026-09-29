import { yen, statusLabel } from "@/lib/format";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Order = {
  id: string;
  buyer_email: string;
  amount: number;
  platform_fee: number;
  creator_revenue: number;
  status: string;
  payment_mode: "test" | "live";
  created_at: string;
  digital_products: {
    title: string;
    works: { title: string } | null;
  } | null;
};

export default async function SalesPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id,buyer_email,amount,platform_fee,creator_revenue,status,payment_mode,created_at,digital_products:product_id(title,works:work_id(title))")
    .eq("creator_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<Order[]>();

  const total = orders
    ?.filter((order) => order.status === "paid" && order.payment_mode === "live")
    .reduce((sum, order) => sum + order.creator_revenue, 0) ?? 0;

  return (
    <main className="page">
      <h1 className="text-3xl font-bold">売上管理</h1>
      <div className="panel mt-6">
        <p className="text-lg text-stone-600">クリエイター受取予定額</p>
        <p className="mt-2 text-4xl font-bold">{yen(total)}</p>
        <p className="mt-3 text-sm text-stone-600">テスト購入は受取予定額に含みません。</p>
      </div>
      <section className="panel mt-6">
        <h2 className="text-2xl font-bold">注文一覧</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-base">
            <thead>
              <tr className="border-b border-stone-200">
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
              {orders?.length ? orders.map((order) => (
                <tr className="border-b border-stone-100" key={order.id}>
                  <td className="py-3">{order.buyer_email}</td>
                  <td className="py-3">
                    <span className="block font-semibold">{order.digital_products?.works?.title ?? "作品情報なし"}</span>
                    <span className="block text-sm text-stone-600">{order.digital_products?.title ?? "商品情報なし"}</span>
                  </td>
                  <td className="py-3">{yen(order.amount)}</td>
                  <td className="py-3">{yen(order.platform_fee)}</td>
                  <td className="py-3 font-semibold">{yen(order.creator_revenue)}</td>
                  <td className="py-3">{statusLabel(order.status)}</td>
                  <td className="py-3">{order.payment_mode === "test" ? "テスト" : "本番"}</td>
                </tr>
              )) : (
                <tr><td className="py-5 text-stone-600" colSpan={7}>注文はまだありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
