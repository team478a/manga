import { BadgeJapaneseYen, Boxes, Bot, Image, PackageCheck, ReceiptText, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { yen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type OrderSummary = {
  amount: number;
  status: string;
};

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [users, publicWorks, products, goodsRequests, ordersCount, orders] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("works").select("id", { count: "exact", head: true }).eq("is_public", true),
    supabase.from("digital_products").select("id", { count: "exact", head: true }),
    supabase.from("goods_requests").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("amount,status").returns<OrderSummary[]>()
  ]);

  const salesTotal = orders.data?.filter((order) => order.status === "paid").reduce((sum, order) => sum + order.amount, 0) ?? 0;
  const cards = [
    { title: "登録ユーザー数", count: users.count ?? 0, href: "/admin/users", icon: Users },
    { title: "公開作品数", count: publicWorks.count ?? 0, href: "/admin/works", icon: Image },
    { title: "デジタル商品数", count: products.count ?? 0, href: "/admin/products", icon: Boxes },
    { title: "グッズ販売申請数", count: goodsRequests.count ?? 0, href: "/admin/goods-requests", icon: PackageCheck },
    { title: "注文数", count: ordersCount.count ?? 0, href: "/admin/orders", icon: ReceiptText },
    { title: "売上合計（仮）", count: yen(salesTotal), href: "/admin/orders", icon: BadgeJapaneseYen },
    { title: "Cloud AI運用", count: "設定・監視", href: "/admin/cloud-ai", icon: Bot }
  ];

  return (
    <main className="page">
      <PageHeader
        title="管理者ダッシュボード"
        description="ユーザー、作品、商品、申請、注文の状況を一目で確認できます。売上合計は支払い済み注文の金額を仮集計しています。"
      />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <ButtonLink
            className="h-auto items-start justify-start whitespace-normal p-0 text-left"
            href={card.href}
            key={card.title}
            variant="ghost"
          >
            <Card className="h-full w-full" variant="interactive">
              <card.icon className="h-8 w-8 text-leaf" />
              <p className="mt-4 text-lg text-text-secondary">{card.title}</p>
              <p className="mt-3 text-4xl font-bold">{card.count}</p>
            </Card>
          </ButtonLink>
        ))}
      </div>
    </main>
  );
}
