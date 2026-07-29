import type { ReactNode } from "react";
import { CreatorSectionLayout } from "@/components/layout/CreatorSectionLayout";
import type { SectionNavItem } from "@/components/layout/SectionNav";

const creatorNav = [
  { href: "/creator", label: "Project一覧", exact: true, group: "制作", icon: "creator" },
  { href: "/creator/new", label: "新しいProject", exact: true, group: "制作", icon: "new" },
  { href: "/creator/trash", label: "ゴミ箱", exact: true, group: "管理", icon: "trash" },
  { href: "/dashboard", label: "Dashboardへ", exact: true, group: "管理", icon: "dashboard" },
] satisfies SectionNavItem[];

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return (
    <CreatorSectionLayout navItems={creatorNav}>
      {children}
    </CreatorSectionLayout>
  );
}
