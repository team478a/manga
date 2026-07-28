"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export type SectionNavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

function isActivePath(pathname: string, item: SectionNavItem) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
export function SectionNav({
  label,
  items,
}: {
  label: string;
  items: SectionNavItem[];
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
        {items.map((item) => {
          const active = isActivePath(pathname, item);
          return (
            <li key={item.href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "block rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                  active
                    ? "bg-leaf text-white shadow-sm"
                    : "text-text-secondary hover:bg-linen hover:text-ink",
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
