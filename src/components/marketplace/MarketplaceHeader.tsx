import Link from "next/link";
import { BookOpen, Heart, LogIn, LogOut, Search } from "lucide-react";
import { signOut } from "@/app/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { MarketplaceMobileNavigation } from "@/components/marketplace/MarketplaceMobileNavigation";
import type { Profile } from "@/lib/types";

export function MarketplaceHeader({
  profile,
}: {
  profile: Pick<Profile, "role"> | null;
}) {
  const canCreate = profile?.role === "creator" || profile?.role === "admin";

  return (
    <>
      <header className="marketplace-header sticky top-0 z-40 border-b border-stone-200/90 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="shrink-0 rounded-md text-violet-800 outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-4"
          >
            <span className="block text-xl font-black tracking-[0.08em] sm:text-2xl">
              MANGAI
            </span>
            <span className="hidden text-[11px] font-semibold tracking-wide text-stone-500 sm:block">
              インディーズ漫画のデジタル書店
            </span>
          </Link>

          <form
            action="/works"
            className="relative hidden min-w-0 flex-1 md:block lg:max-w-xl"
            method="get"
            role="search"
          >
            <label className="sr-only" htmlFor="marketplace-header-search">
              漫画を検索
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400"
            />
            <input
              className="h-11 w-full rounded-full border border-stone-300 bg-stone-50 pl-11 pr-4 text-base text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
              id="marketplace-header-search"
              maxLength={100}
              name="q"
              placeholder="タイトルやあらすじから探す"
              type="search"
            />
          </form>

          <nav
            aria-label="メインナビゲーション"
            className="ml-auto hidden items-center gap-1 lg:flex"
          >
            <Link className="marketplace-header-link" href="/works">
              漫画を探す
            </Link>
            <Link
              className="marketplace-header-link"
              href="/dashboard/purchases"
            >
              本棚
            </Link>
            {profile ? (
              <Link
                className="marketplace-header-link"
                href="/dashboard/favorites"
              >
                あとで読む
              </Link>
            ) : null}
            {canCreate ? (
              <Link className="marketplace-header-link" href="/creator">
                漫画を作る
              </Link>
            ) : null}
            {profile ? (
              <>
                <Link className="marketplace-header-link" href="/dashboard">
                  マイページ
                </Link>
                <form action={signOut}>
                  <PendingSubmitButton
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-stone-300 bg-white px-4 text-sm font-bold text-stone-700 transition hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                    pendingLabel="ログアウト中…"
                  >
                    <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
                    ログアウト
                  </PendingSubmitButton>
                </form>
              </>
            ) : (
              <>
                <Link className="marketplace-header-link" href="/login">
                  <LogIn aria-hidden="true" className="mr-1.5 h-4 w-4" />
                  ログイン
                </Link>
                <Link
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-violet-700 px-5 text-sm font-bold text-white transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                  href="/signup"
                >
                  新規登録
                </Link>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <Link
              aria-label="漫画を検索"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-stone-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              href="/works"
            >
              <Search aria-hidden="true" className="h-5 w-5" />
            </Link>
            <Link
              aria-label="本棚を開く"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-stone-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              href="/dashboard/purchases"
            >
              <BookOpen aria-hidden="true" className="h-5 w-5" />
            </Link>
            {profile ? (
              <Link
                aria-label="あとで読むを開く"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-stone-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                href="/dashboard/favorites"
              >
                <Heart aria-hidden="true" className="h-5 w-5" />
              </Link>
            ) : null}
          </div>
        </div>
      </header>
      <MarketplaceMobileNavigation />
    </>
  );
}
