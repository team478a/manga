import Link from "next/link";
import {
  BadgeJapaneseYen,
  Boxes,
  Bot,
  BrainCircuit,
  Bug,
  Images,
  Image,
  KeyRound,
  ListChecks,
  Megaphone,
  PackageCheck,
  ReceiptText,
  ScanSearch,
  ShieldCheck,
  Users,
  UserRoundCheck,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { yen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { loadAdminVisibleUserCount } from "@/modules/account/infrastructure/admin-user-repository";
import { loadAdminOrderMetrics } from "@/modules/sales/infrastructure/admin-sales-query-repository";

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [users, publicWorks, products, goodsRequests, orderMetrics] =
    await Promise.all([
      safelyLoadAdminData("dashboard/users", () =>
        loadAdminVisibleUserCount(hasSupabaseAdminEnv()),
      ),
      supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("is_public", true),
      supabase
        .from("digital_products")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("goods_requests")
        .select("id", { count: "exact", head: true }),
      safelyLoadAdminData("dashboard/orders", loadAdminOrderMetrics),
    ]);

  const cards = [
    {
      title: "登録ユーザー数",
      count: users.ok ? users.value : "確認",
      href: "/admin/users",
      icon: Users,
    },
    {
      title: "公開作品数",
      count: publicWorks.count ?? 0,
      href: "/admin/works",
      icon: Image,
    },
    {
      title: "デジタル商品数",
      count: products.count ?? 0,
      href: "/admin/products",
      icon: Boxes,
    },
    {
      title: "グッズ販売申請数",
      count: goodsRequests.count ?? 0,
      href: "/admin/goods-requests",
      icon: PackageCheck,
    },
    {
      title: "注文数",
      count: orderMetrics.ok ? orderMetrics.value.orderCount : "確認",
      href: "/admin/orders",
      icon: ReceiptText,
    },
    {
      title: "Marketplace canary候補",
      count: "件数のみ確認",
      href: "/admin/marketplace-canary",
      icon: ListChecks,
    },
    {
      title: "外部作品審査",
      count: "承認・停止",
      href: "/admin/external-submissions",
      icon: ScanSearch,
    },
    {
      title: "本番売上合計（仮）",
      count: orderMetrics.ok ? yen(orderMetrics.value.livePaidTotal) : "確認",
      href: "/admin/orders",
      icon: BadgeJapaneseYen,
    },
    {
      title: "Cloud AI運用",
      count: "設定・監視",
      href: "/admin/cloud-ai",
      icon: Bot,
    },
    {
      title: "生成品質ギャラリー",
      count: "未完成候補も確認",
      href: "/admin/generation-quality",
      icon: Images,
    },
    {
      title: "外部API設定",
      count: "APIキーを一括管理",
      href: "/admin/provider-settings",
      icon: KeyRound,
    },
    {
      title: "市場分析AI",
      count: "API・model設定",
      href: "/admin/research-ai",
      icon: BrainCircuit,
    },
    {
      title: "一般向けモニター",
      count: "招待・停止・感想",
      href: "/admin/general-monitors",
      icon: UserRoundCheck,
    },
    {
      title: "更新情報",
      count: "作成・公開",
      href: "/admin/product-updates",
      icon: Megaphone,
    },
    {
      title: "報告・自動修正",
      count: "検知・承認",
      href: "/admin/monitor-issues",
      icon: Bug,
    },
    {
      title: "成人向け市場分析",
      count: "許可制",
      href: "/admin/adult-research",
      icon: ShieldCheck,
    },
  ];

  return (
    <main className="page">
      <h1 className="text-3xl font-bold">管理者ダッシュボード</h1>
      <p className="mt-3 text-lg leading-relaxed text-stone-600">
        ユーザー、作品、商品、申請、注文の状況を一目で確認できます。売上合計は支払い済みの本番注文だけを仮集計し、テスト購入は含みません。
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            className="panel block transition hover:-translate-y-0.5 hover:border-leaf"
            href={card.href}
            key={card.title}
          >
            <card.icon className="h-8 w-8 text-leaf" />
            <p className="mt-4 text-lg text-stone-600">{card.title}</p>
            <p className="mt-3 text-4xl font-bold">{card.count}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
