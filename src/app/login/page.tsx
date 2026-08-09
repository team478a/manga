import { signIn } from "@/app/actions";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import Link from "next/link";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;

  return (
    <main className="page max-w-xl">
      <h1 className="text-3xl font-bold">ログイン</h1>
      <p className="mt-3 text-lg text-stone-600">登録したメールアドレスで入れます。</p>
      {params.message ? <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">{params.message}</p> : null}
      {params.error ? <InlineErrorMessage>{params.error}</InlineErrorMessage> : null}
      <form action={signIn} className="panel mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="email">メールアドレス</label>
          <input className="field" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">パスワード</label>
          <input className="field" id="password" name="password" type="password" required />
          <div className="mt-2 text-right">
            <Link className="text-sm font-medium text-green-800 hover:underline" href="/forgot-password">
              パスワードを忘れた方
            </Link>
          </div>
        </div>
        <PendingSubmitButton className="button w-full" pendingLabel="ログイン中…">
          ログインする
        </PendingSubmitButton>
      </form>
    </main>
  );
}
