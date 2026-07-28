"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  SectionShell,
} from "@/components/layout/SectionShell";
import type { SectionNavItem } from "@/components/layout/SectionNav";

export function CreatorSectionLayout({
  navItems,
  children,
}: {
  navItems: SectionNavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (/^\/creator\/[^/]+\/pages\/[^/]+/.test(pathname)) return children;

  return (
    <SectionShell
      sectionTitle="Cloud Creator"
      sectionDescription="一般漫画のProjectとPageを制作"
      navLabel="Cloud Creatorメニュー"
      navItems={navItems}
    >
      {children}
    </SectionShell>
  );
}
