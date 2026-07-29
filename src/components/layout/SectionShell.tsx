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
    <div className="w-full bg-brand-50/60 lg:grid lg:min-h-[calc(100vh-57px)] lg:grid-cols-[208px_minmax(0,1fr)]">
      <aside className="border-b border-brand-100 bg-white lg:min-h-[calc(100vh-57px)] lg:border-b-0 lg:border-r">
        <div className="px-3 py-3 sm:px-6 lg:sticky lg:top-[57px] lg:px-2 lg:py-5">
          <div className="hidden lg:block">
            <p className="px-3 text-sm font-black text-brand-700">
              {sectionTitle}
            </p>
            <p className="mt-1 px-3 text-xs leading-relaxed text-text-muted">
              {sectionDescription}
            </p>
          </div>
          <div className="overflow-x-auto lg:mt-4 lg:overflow-visible">
            <SectionNav items={navItems} label={navLabel} />
          </div>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
