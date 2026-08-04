import { updatePassword } from "@/app/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="page max-w-xl">
      <h1 className="text-3xl font-bold">新しいパスワード</h1>
      <p className="mt-3 text-lg text-stone-600">
        新しく使用するパスワードを入力してください。
      </p>
      {params.error ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{params.error}</p>
      ) : null}
      <form action={updatePassword} className="panel mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="password">新しいパスワード</label>
          <input className="field" id="password" name="password" type="password" minLength={8} required />
          <p className="mt-2 text-sm text-stone-500">8文字以上で入力してください。</p>
        </div>
        <div>
          <label className="label" htmlFor="passwordConfirmation">新しいパスワード（確認）</label>
          <input
            className="field"
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            minLength={8}
            required
          />
        </div>
        <PendingSubmitButton className="button w-full" pendingLabel="更新中…">
          パスワードを更新する
        </PendingSubmitButton>
      </form>
    </main>
  );
}
