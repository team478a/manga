import { signUp } from "@/app/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;

  return (
    <main className="page max-w-xl">
      <h1 className="text-3xl font-bold">新規登録</h1>
      <p className="mt-3 text-lg text-stone-600">まずは無料で作品投稿の準備を始めましょう。</p>
      {params.message ? <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">{params.message}</p> : null}
      {params.error ? <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{params.error}</p> : null}
      <form action={signUp} className="panel mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="displayName">表示名</label>
          <input className="field" id="displayName" name="displayName" required placeholder="例：山田 花子" />
        </div>
        <div>
          <label className="label" htmlFor="email">メールアドレス</label>
          <input className="field" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">パスワード</label>
          <input className="field" id="password" name="password" type="password" minLength={8} required />
          <p className="mt-2 text-sm text-stone-500">8文字以上で入力してください。</p>
        </div>
        <div>
          <label className="label" htmlFor="passwordConfirmation">パスワード（確認）</label>
          <input
            className="field"
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            minLength={8}
            required
          />
        </div>
        <button className="button w-full" type="submit">登録する</button>
      </form>
    </main>
  );
}
