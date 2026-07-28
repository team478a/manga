import type { ReactNode } from "react";
import { SectionShell } from "@/components/layout/SectionShell";

const dashboardNav = [
  { href: "/dashboard", label: "概要", exact: true },
  { href: "/dashboard/works", label: "作品管理" },
  { href: "/dashboard/products", label: "デジタル商品" },
  { href: "/dashboard/sales", label: "売上管理" },
  { href: "/dashboard/purchases", label: "購入履歴" },
  { href: "/dashboard/goods-requests", label: "グッズ申請" },
  { href: "/dashboard/billing", label: "Cloud AIプラン" },
  { href: "/dashboard/devices", label: "Desktop端末" },
  { href: "/dashboard/notifications", label: "通知" },
];

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
