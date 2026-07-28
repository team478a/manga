import { CircleDollarSign, CreditCard, ReceiptText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
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
  created_at: string;
};

function orderTone(status: string): StatusTone {
  if (status === "paid") return "success";
  if (status === "failed" || status === "canceled") return "danger";
  if (status === "refunded") return "warning";
  return "neutral";
}

export default async function SalesPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("creator_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<Order[]>();

  const rows = orders ?? [];
  const total = rows.reduce(
    (sum, order) => sum + order.creator_revenue,
    0,
  );
  const paidCount = rows.filter((order) => order.status === "paid").length;

  const metrics = [
    {
      label: "クリエイター受取予定額",
      value: yen(total),
      icon: CircleDollarSign,
      tone: "bg-brand-50 text-brand-600",
    },
    {
      label: "注文数",
      value: `${rows.length}件`,
      icon: ReceiptText,
      tone: "bg-blue-50 text-status-info",
    },
    {
      label: "支払い済み",
      value: `${paidCount}件`,
      icon: CreditCard,
      tone: "bg-green-50 text-status-success",
    },
  ];

  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-7 xl:px-8">
      <div className="mx-auto max-w-[1600px]">
        <PageHeader
          eyebrow="Revenue"
          title="売上管理"
          description="注文状況、手数料、クリエイター受取予定額を確認できます。"
        />

        <section
          aria-label="売上サマリー"
          className="mt-6 grid gap-3 sm:grid-cols-3"
        >
          {metrics.map((metric) => (
            <Card className="p-4 shadow-app" key={metric.label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-text-muted">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight">
                    {metric.value}
                  </p>
                </div>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${metric.tone}`}
                >
                  <metric.icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </Card>
          ))}
        </section>

        <Card className="mt-5 overflow-hidden p-0 shadow-app">
          <div className="border-b border-brand-100 px-4 py-3 sm:px-5">
            <h2 className="font-bold">注文一覧</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              新しい注文から順に表示
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-brand-50/70 text-xs text-text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">購入者</th>
                  <th className="px-4 py-2.5 font-semibold">金額</th>
                  <th className="px-4 py-2.5 font-semibold">手数料</th>
                  <th className="px-4 py-2.5 font-semibold">受取</th>
                  <th className="px-5 py-2.5 text-right font-semibold">
                    状態
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {rows.length ? (
                  rows.map((order) => (
                    <tr className="bg-white hover:bg-brand-50/50" key={order.id}>
                      <td className="px-5 py-3.5">{order.buyer_email}</td>
                      <td className="px-4 py-3.5">{yen(order.amount)}</td>
                      <td className="px-4 py-3.5 text-text-secondary">
                        {yen(order.platform_fee)}
                      </td>
                      <td className="px-4 py-3.5 font-bold">
                        {yen(order.creator_revenue)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <StatusBadge tone={orderTone(order.status)}>
                          {statusLabel(order.status)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-5 py-12 text-center text-text-secondary"
                      colSpan={5}
                    >
                      注文はまだありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}
