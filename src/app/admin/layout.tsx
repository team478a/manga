import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav
        aria-label="管理画面ナビゲーション"
        className="border-b border-stone-200 bg-white"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-stone-500">管理画面</p>
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 transition hover:border-violet-300 hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
            href="/admin"
          >
            <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
            管理画面TOPへ
          </Link>
        </div>
      </nav>
      {children}
    </>
  );
}
