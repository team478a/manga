import { yen, statusLabel } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type AdminOrder = {
  id: string;
  buyer_email: string;
  amount: number;
  platform_fee: number;
  creator_revenue: number;
  status: string;
  created_at: string;
};

export default async function AdminOrdersPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: orders } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).returns<AdminOrder[]>();

  return (
    <main className="page">
      <h1 className="text-3xl font-bold">注文管理</h1>
      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead><tr className="border-b"><th className="py-3">購入者</th><th>金額</th><th>手数料</th><th>作者受取</th><th>状態</th></tr></thead>
          <tbody>
            {orders?.map((order) => (
              <tr className="border-b border-stone-100" key={order.id}>
                <td className="py-3">{order.buyer_email}</td>
                <td>{yen(order.amount)}</td>
                <td>{yen(order.platform_fee)}</td>
                <td>{yen(order.creator_revenue)}</td>
                <td>{statusLabel(order.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
