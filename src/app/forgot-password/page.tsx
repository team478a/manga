import Link from "next/link";
import { requestPasswordReset } from "@/app/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="page max-w-xl">
      <h1 className="text-3xl font-bold">パスワード再設定</h1>
      <p className="mt-3 text-lg text-stone-600">
        登録したメールアドレスへ再設定用リンクを送信します。
      </p>
      {params.error ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{params.error}</p>
      ) : null}
      <form action={requestPasswordReset} className="panel mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="email">メールアドレス</label>
          <input className="field" id="email" name="email" type="email" required />
        </div>
        <PendingSubmitButton className="button w-full" pendingLabel="送信中…">
          再設定メールを送る
        </PendingSubmitButton>
      </form>
      <p className="mt-5 text-center">
        <Link className="font-medium text-green-800 hover:underline" href="/login">
          ログイン画面へ戻る
        </Link>
      </p>
    </main>
  );
}
