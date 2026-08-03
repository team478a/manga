import Link from "next/link";
import { KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { updateProfile } from "@/app/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import {
  updateAccountEmailAction,
  updateAccountPasswordAction,
} from "./actions";

const roleLabels = {
  buyer: "購入者",
  creator: "クリエイター",
  admin: "管理者",
} as const;

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("ja-JP") : "記録なし";
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { user, profile } = await requireProfile();
  const { error, message } = await searchParams;

  return (
    <main className="page max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold text-violet-700">登録情報とセキュリティ</p>
          <h1 className="mt-1 text-3xl font-bold">アカウント管理</h1>
          <p className="mt-2 text-stone-600">
            自分の登録情報を確認し、プロフィールやログイン情報を変更できます。
          </p>
        </div>
        <Link className="button-secondary" href="/dashboard">ダッシュボードへ戻る</Link>
      </div>

      {error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p> : null}
      {message ? <p className="mt-5 rounded-lg bg-green-50 p-4 text-green-800" role="status">{message}</p> : null}

      <section className="panel mt-6">
        <div className="flex items-center gap-3">
          <UserRound className="h-6 w-6 text-violet-700" />
          <h2 className="text-xl font-bold">現在の登録情報</h2>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-stone-50 p-4">
            <dt className="text-sm text-stone-500">表示名</dt>
            <dd className="mt-1 break-words font-bold">{profile.display_name}</dd>
          </div>
          <div className="rounded-lg bg-stone-50 p-4">
            <dt className="text-sm text-stone-500">メールアドレス</dt>
            <dd className="mt-1 break-all font-bold">{user.email ?? "未設定"}</dd>
          </div>
          <div className="rounded-lg bg-stone-50 p-4">
            <dt className="text-sm text-stone-500">アカウント種別</dt>
            <dd className="mt-1 font-bold">{roleLabels[profile.role]}</dd>
          </div>
          <div className="rounded-lg bg-stone-50 p-4">
            <dt className="text-sm text-stone-500">メール確認</dt>
            <dd className="mt-1 font-bold">{user.email_confirmed_at ? "確認済み" : "未確認"}</dd>
          </div>
          <div className="rounded-lg bg-stone-50 p-4">
            <dt className="text-sm text-stone-500">登録日時</dt>
            <dd className="mt-1 font-bold">{formatDate(user.created_at)}</dd>
          </div>
          <div className="rounded-lg bg-stone-50 p-4">
            <dt className="text-sm text-stone-500">最終ログイン</dt>
            <dd className="mt-1 font-bold">{formatDate(user.last_sign_in_at)}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel">
          <div className="flex items-center gap-3">
            <UserRound className="h-6 w-6 text-violet-700" />
            <h2 className="text-xl font-bold">プロフィール</h2>
          </div>
          <form action={updateProfile} className="mt-5 space-y-5">
            <div>
              <label className="label" htmlFor="displayName">表示名</label>
              <input className="field" defaultValue={profile.display_name} id="displayName" maxLength={80} name="displayName" required />
            </div>
            <div>
              <label className="label" htmlFor="bio">自己紹介</label>
              <textarea className="field min-h-32" defaultValue={profile.bio ?? ""} id="bio" maxLength={1000} name="bio" />
            </div>
            <PendingSubmitButton className="button w-full" pendingLabel="保存中…">
              プロフィールを保存
            </PendingSubmitButton>
          </form>
        </section>

        <div className="space-y-6">
          <section className="panel">
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6 text-violet-700" />
              <h2 className="text-xl font-bold">メールアドレス変更</h2>
            </div>
            <p className="mt-2 text-sm text-stone-600">新しいアドレスへ確認メールを送信します。</p>
            <form action={updateAccountEmailAction} className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="email">新しいメールアドレス</label>
                <input className="field" id="email" name="email" type="email" required />
              </div>
              <PendingSubmitButton className="button-secondary w-full" pendingLabel="確認メールを送信中…">
                確認メールを送信
              </PendingSubmitButton>
            </form>
          </section>

          <section className="panel">
            <div className="flex items-center gap-3">
              <KeyRound className="h-6 w-6 text-violet-700" />
              <h2 className="text-xl font-bold">パスワード変更</h2>
            </div>
            <p className="mt-2 text-sm text-stone-600">変更後は安全のためログアウトします。</p>
            <form action={updateAccountPasswordAction} className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="password">新しいパスワード</label>
                <input className="field" id="password" minLength={8} name="password" type="password" required />
              </div>
              <div>
                <label className="label" htmlFor="passwordConfirmation">新しいパスワード（確認）</label>
                <input className="field" id="passwordConfirmation" minLength={8} name="passwordConfirmation" type="password" required />
              </div>
              <PendingSubmitButton className="button-secondary w-full" pendingLabel="変更中…">
                パスワードを変更
              </PendingSubmitButton>
            </form>
          </section>
        </div>
      </div>

      <section className="panel mt-6 border-amber-200 bg-amber-50">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-amber-700" />
          <h2 className="text-xl font-bold">利用停止・退会について</h2>
        </div>
        <p className="mt-2 text-stone-700">
          作品・購入・モニター記録の誤削除を防ぐため、現在は管理者が本人確認後に対応します。管理者へご連絡ください。
        </p>
      </section>
    </main>
  );
}
