import { signIn } from "@/app/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;

  return (
    <main className="page max-w-xl">
      <h1 className="text-3xl font-bold">ログイン</h1>
      <p className="mt-3 text-lg text-stone-600">登録したメールアドレスで入れます。</p>
      {params.message ? <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">{params.message}</p> : null}
      {params.error ? <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{params.error}</p> : null}
      <form action={signIn} className="panel mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="email">メールアドレス</label>
          <input className="field" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">パスワード</label>
          <input className="field" id="password" name="password" type="password" required />
        </div>
        <button className="button w-full" type="submit">ログインする</button>
      </form>
    </main>
  );
}
