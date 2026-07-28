import type { ReactNode } from "react";
import { CreatorSectionLayout } from "@/components/layout/CreatorSectionLayout";

const creatorNav = [
  { href: "/creator", label: "Project一覧", exact: true },
  { href: "/creator/new", label: "新しいProject", exact: true },
  { href: "/creator/trash", label: "ゴミ箱", exact: true },
  { href: "/dashboard", label: "Dashboardへ", exact: true },
];

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return (
    <CreatorSectionLayout navItems={creatorNav}>
      {children}
    </CreatorSectionLayout>
  );
}
