import type { ReactNode } from "react";
import { SectionNav, type SectionNavItem } from "@/components/layout/SectionNav";

export function SectionShell({
  sectionTitle,
  sectionDescription,
  navLabel,
  navItems,
  children,
}: {
  sectionTitle: string;
  sectionDescription: string;
  navLabel: string;
  navItems: SectionNavItem[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-border-subtle bg-white lg:min-h-[calc(100vh-73px)] lg:border-b-0 lg:border-r">
        <div className="px-4 py-4 sm:px-6 lg:sticky lg:top-[73px] lg:px-5 lg:py-7">
          <div className="hidden lg:block">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-leaf">
              {sectionTitle}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              {sectionDescription}
            </p>
          </div>
          <div className="overflow-x-auto lg:mt-6 lg:overflow-visible">
            <SectionNav items={navItems} label={navLabel} />
          </div>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
