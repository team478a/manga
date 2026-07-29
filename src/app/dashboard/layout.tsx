import type { ReactNode } from "react";
import { SectionShell } from "@/components/layout/SectionShell";
import type { SectionNavItem } from "@/components/layout/SectionNav";

const dashboardNav = [
  { href: "/dashboard", label: "ダッシュボード", exact: true, group: "メイン", icon: "dashboard" },
  { href: "/dashboard/works", label: "作品管理", group: "制作", icon: "works" },
  { href: "/dashboard/products", label: "デジタル商品", group: "販売", icon: "products" },
  { href: "/dashboard/goods-requests", label: "グッズ申請", group: "販売", icon: "goods" },
  { href: "/dashboard/sales", label: "売上管理", group: "収益", icon: "sales" },
  { href: "/dashboard/purchases", label: "購入履歴", group: "収益", icon: "purchases" },
  { href: "/dashboard/billing", label: "Cloud AIプラン", group: "設定", icon: "billing" },
  { href: "/dashboard/devices", label: "Desktop端末", group: "設定", icon: "devices" },
  { href: "/dashboard/notifications", label: "通知", group: "設定", icon: "notifications" },
] satisfies SectionNavItem[];

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SectionShell
      sectionTitle="Dashboard"
      sectionDescription="作品・販売・アカウントを管理"
      navLabel="Dashboardメニュー"
      navItems={dashboardNav}
    >
      {children}
    </SectionShell>
  );
}
