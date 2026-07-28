"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Bell,
  Bot,
  Boxes,
  CreditCard,
  FilePlus2,
  Images,
  LayoutDashboard,
  Library,
  MonitorSmartphone,
  PackageCheck,
  PackagePlus,
  PanelsTopLeft,
  ReceiptText,
  Settings,
  ShoppingBag,
  Trash2,
  Users,
} from "lucide-react";

export type SectionNavIcon =
  | "dashboard"
  | "works"
  | "products"
  | "sales"
  | "purchases"
  | "goods"
  | "billing"
  | "devices"
  | "notifications"
  | "creator"
  | "new"
  | "trash"
  | "users"
  | "orders"
  | "ai"
  | "settings";

export type SectionNavItem = {
  href: string;
  label: string;
  exact?: boolean;
  group?: string;
  icon?: SectionNavIcon;
};

const icons = {
  dashboard: LayoutDashboard,
  works: Images,
  products: ShoppingBag,
  sales: ReceiptText,
  purchases: Library,
  goods: PackagePlus,
  billing: CreditCard,
  devices: MonitorSmartphone,
  notifications: Bell,
  creator: PanelsTopLeft,
  new: FilePlus2,
  trash: Trash2,
  users: Users,
  orders: PackageCheck,
  ai: Bot,
  settings: Settings,
} satisfies Record<SectionNavIcon, typeof LayoutDashboard>;

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
        {items.map((item, index) => {
          const active = isActivePath(pathname, item);
          const Icon = item.icon ? icons[item.icon] : Boxes;
          const showGroup = item.group && items[index - 1]?.group !== item.group;
          return (
            <li className={clsx(showGroup && "lg:mt-4")} key={item.href}>
              {showGroup ? (
                <p className="mb-2 hidden px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-500 lg:block">
                  {item.group}
                </p>
              ) : null}
              <Link
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                  active
                    ? "bg-brand-100 text-brand-700"
                    : "text-text-secondary hover:bg-brand-50 hover:text-brand-700",
                )}
                href={item.href}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
