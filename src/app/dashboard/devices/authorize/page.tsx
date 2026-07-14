import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { approveDesktopDevice } from "../actions";

export default async function AuthorizeDevicePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  await requireProfile();
  const params = await searchParams;
  return (
    <main className="page max-w-2xl">
      <div className="panel space-y-6">
        <div>
          <p className="font-semibold text-leaf">MANGAI Desktop</p>
          <h1 className="mt-2 text-3xl font-bold">端末認証コードを承認</h1>
          <p className="mt-3 leading-relaxed text-stone-600">
            Desktopに表示されたコードと一致することを確認してください。承認すると、自分の作品と商品の状態を読み取れるようになります。編集・公開・決済の権限は付与されません。
          </p>
        </div>
        {params.error ? (
          <p className="rounded-md bg-red-50 p-4 text-red-700">
            {params.error}
          </p>
        ) : null}
        <form action={approveDesktopDevice} className="space-y-5">
          <div>
            <label className="label" htmlFor="code">
              8桁の認証コード
            </label>
            <input
              autoCapitalize="characters"
              autoComplete="one-time-code"
              className="field font-mono text-xl tracking-widest"
              defaultValue={params.code ?? ""}
              id="code"
              maxLength={9}
              name="code"
              pattern="[A-Za-z2-9]{4}-[A-Za-z2-9]{4}"
              placeholder="ABCD-2345"
              required
            />
          </div>
          <div className="rounded-md bg-amber-50 p-4 text-amber-900">
            自分で認証を開始していない場合は承認しないでください。コードの有効時間は15分です。
          </div>
          <button className="button w-full" type="submit">
            このDesktop端末を承認
          </button>
        </form>
        <Link className="button-secondary w-full" href="/dashboard/devices">
          端末一覧へ戻る
        </Link>
      </div>
    </main>
  );
}
