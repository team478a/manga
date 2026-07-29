import type { ReactNode } from "react";
import { SectionShell } from "@/components/layout/SectionShell";
import type { SectionNavItem } from "@/components/layout/SectionNav";

const adminNav = [
  { href: "/admin", label: "ダッシュボード", exact: true, group: "メイン", icon: "dashboard" },
  { href: "/admin/users", label: "ユーザー", group: "コンテンツ", icon: "users" },
  { href: "/admin/works", label: "作品", group: "コンテンツ", icon: "works" },
  { href: "/admin/products", label: "商品", group: "販売", icon: "products" },
  { href: "/admin/orders", label: "注文", group: "販売", icon: "orders" },
  { href: "/admin/goods-requests", label: "グッズ申請", group: "販売", icon: "goods" },
  { href: "/admin/cloud-ai", label: "Cloud AI運用", group: "運用", icon: "ai" },
] satisfies SectionNavItem[];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SectionShell
      sectionTitle="Admin"
      sectionDescription="公開・販売・Cloud AIを運用"
      navLabel="管理者メニュー"
      navItems={adminNav}
    >
      {children}
    </SectionShell>
  );
}
