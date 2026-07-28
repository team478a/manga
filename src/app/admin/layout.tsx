import type { ReactNode } from "react";
import { SectionShell } from "@/components/layout/SectionShell";

const adminNav = [
  { href: "/admin", label: "運用概要", exact: true },
  { href: "/admin/users", label: "ユーザー" },
  { href: "/admin/works", label: "作品" },
  { href: "/admin/products", label: "商品" },
  { href: "/admin/orders", label: "注文" },
  { href: "/admin/goods-requests", label: "グッズ申請" },
  { href: "/admin/cloud-ai", label: "Cloud AI運用" },
];

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
