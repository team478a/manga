import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { approveDesktopDevice } from "../actions";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AuthorizeDevicePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  await requireProfile();
  const params = await searchParams;
  const normalizedCode = params.code?.trim().toUpperCase() ?? "";
  const authorization = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(normalizedCode)
    ? await createAdminClient()
        .from("desktop_device_authorizations")
        .select("scopes")
        .eq("user_code", normalizedCode)
        .eq("status", "pending")
        .maybeSingle<{ scopes: string[] }>()
    : { data: null };
  const canWriteDraft =
    authorization.data?.scopes.includes("works:write:draft") ?? false;
  return (
    <main className="page max-w-2xl">
      <div className="panel space-y-6">
        <div>
          <p className="font-semibold text-leaf">MANGAI Desktop</p>
          <h1 className="mt-2 text-3xl font-bold">端末認証コードを承認</h1>
          <p className="mt-3 leading-relaxed text-stone-600">
            Desktopに表示されたコードと一致することを確認してください。承認すると、自分の作品と商品の状態を読み取れるようになります。
          </p>
        </div>
        {params.error ? (
          <p className="rounded-md bg-red-50 p-4 text-red-700">
            {params.error}
          </p>
        ) : null}
        <form action={approveDesktopDevice} className="space-y-5">
          {authorization.data ? (
            <input
              name="scopeConfirmation"
              type="hidden"
              value={[...authorization.data.scopes].sort().join(",")}
            />
          ) : null}
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
          <div className="rounded-md border border-stone-200 p-4 text-stone-700">
            <p className="font-semibold">この端末へ付与する権限</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>自分の作品・商品状態の読み取り</li>
              {canWriteDraft ? (
                <li>非公開下書きの作品名・説明だけを更新</li>
              ) : null}
            </ul>
            <p className="mt-2 text-sm">
              公開状態、商品、価格、販売ファイル、決済情報は変更できません。
            </p>
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
