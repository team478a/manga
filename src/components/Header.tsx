import Link from "next/link";
import { LogIn, LogOut, Search, UserPlus } from "lucide-react";
import { signOut } from "@/app/actions";
import { getCurrentProfile } from "@/lib/auth";

export async function Header() {
  const { profile } = await getCurrentProfile();

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="text-2xl font-bold tracking-normal text-ink">
          MANGAI Creator
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-base">
          <Link className="button-secondary" href="/works">
            <Search className="mr-2 h-5 w-5" />
            作品を探す
          </Link>
          <Link className="button-secondary" href="/sales-packages">
            販売パッケージ
          </Link>
          {profile ? (
            <>
              <Link className="button-secondary" href="/dashboard">
                マイページ
              </Link>
              <form action={signOut}>
                <button className="button-secondary" type="submit">
                  <LogOut className="mr-2 h-5 w-5" />
                  ログアウト
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className="button-secondary" href="/login">
                <LogIn className="mr-2 h-5 w-5" />
                ログイン
              </Link>
              <Link className="button" href="/signup">
                <UserPlus className="mr-2 h-5 w-5" />
                新規登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
