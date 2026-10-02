"use client";

import Link from "next/link";
import { BookOpen, Home, Search, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", icon: Home, label: "ホーム" },
  { href: "/works", icon: Search, label: "探す" },
  { href: "/dashboard/purchases", icon: BookOpen, label: "本棚" },
  { href: "/dashboard", icon: UserRound, label: "マイページ" },
] as const;

function isMarketplaceRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/works" ||
    /^\/works\/[^/]+$/.test(pathname) ||
    pathname === "/dashboard" ||
    pathname === "/dashboard/purchases"
  );
}

function isCurrentRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/works") return pathname.startsWith("/works");
  return pathname === href;
}

export function MarketplaceMobileNavigation() {
  const pathname = usePathname();
  if (!isMarketplaceRoute(pathname)) return null;

  return (
    <nav
      aria-label="モバイルナビゲーション"
      className="marketplace-mobile-nav fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-4">
        {items.map((item) => {
          const current = isCurrentRoute(pathname, item.href);
          return (
            <Link
              aria-current={current ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 ${
                current
                  ? "text-violet-700"
                  : "text-stone-500 hover:bg-violet-50 hover:text-violet-700"
              }`}
              href={item.href}
              key={item.href}
            >
              <item.icon aria-hidden="true" className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
