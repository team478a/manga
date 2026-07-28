import Link from "next/link";
import { LogOut, Menu, Sparkles } from "lucide-react";
import { signOut } from "@/app/actions";
import { getCurrentProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";

function Navigation({
  profile,
  mobile = false,
}: {
  profile: Profile | null;
  mobile?: boolean;
}) {
  const linkClass = mobile ? "cloud-nav-link-mobile" : "cloud-nav-link";
  return (
    <>
      <Link className={linkClass} href="/works">
        作品を探す
      </Link>
      {profile?.role === "creator" || profile?.role === "admin" ? (
        <Link className={linkClass} href="/creator">
          Cloud Creator
        </Link>
      ) : null}
      {profile ? (
        <>
          <Link className={linkClass} href="/dashboard">
            Dashboard
          </Link>
          {profile.role === "admin" ? (
            <Link className={linkClass} href="/admin">
              Admin
            </Link>
          ) : null}
          <form action={signOut}>
            <button
              className={mobile ? "cloud-nav-link-mobile w-full" : linkClass}
              type="submit"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              ログアウト
            </button>
          </form>
        </>
      ) : (
        <>
          <Link className={linkClass} href="/login">
            ログイン
          </Link>
          <Link
            className={mobile ? "ui-button ui-button-brand ui-button-md mt-2" : "ui-button ui-button-brand ui-button-sm"}
            href="/signup"
          >
            無料ではじめる
          </Link>
        </>
      )}
    </>
  );
}

export async function Header() {
  const { profile } = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-50 border-b border-brand-100 bg-white/95 backdrop-blur">
      <div className="flex min-h-[56px] w-full items-center justify-between gap-4 px-4 sm:px-5 lg:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md text-lg font-black tracking-tight text-ink"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>MANGAI</span>
          <span className="hidden text-xs font-semibold text-text-muted sm:inline">
            Cloud
          </span>
        </Link>

        <nav
          aria-label="Cloud共通メニュー"
          className="hidden items-center gap-1 lg:flex"
        >
          <Navigation profile={profile} />
        </nav>

        <details className="group relative lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-border-subtle bg-white px-3 py-2 font-semibold marker:content-none">
            <Menu className="h-5 w-5" aria-hidden="true" />
            メニュー
          </summary>
          <nav
            aria-label="Cloud共通モバイルメニュー"
            className="absolute right-0 top-[calc(100%+0.5rem)] flex w-64 flex-col rounded-xl border border-border-subtle bg-white p-3 shadow-dialog"
          >
            <Navigation mobile profile={profile} />
          </nav>
        </details>
      </div>
    </header>
  );
}
