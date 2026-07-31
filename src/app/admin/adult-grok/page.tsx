import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getCloudAdultGrokSettings } from "@/lib/cloud-adult-grok-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateCloudAdultGrokAction } from "./actions";

type Audit = {
  id: string;
  action: string;
  model: string;
  enabled: boolean;
  created_at: string;
};

export default async function AdultGrokAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const settings = await getCloudAdultGrokSettings();
  const admin = createAdminClient();
  const { data: audits } = await admin
    .from("cloud_adult_grok_audit_logs")
    .select("id,action,model,enabled,created_at")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<Audit[]>();

  return (
    <main className="page max-w-4xl">
      <Link className="text-violet-700 underline" href="/admin">← 管理者ダッシュボード</Link>
      <h1 className="mt-4 text-3xl font-bold">成人向けAI（Grok）設定</h1>
      <p className="mt-2 text-stone-600">
        許可済み成人ユーザーの市場分析・企画・シナリオ・ネームに使うxAI接続です。
        一般向けOpenAIとはキーも経路も分離されます。画像生成には使用しません。
      </p>
      {query.message ? <p className="mt-4 rounded-lg bg-green-50 p-4 text-green-800" role="status">{query.message}</p> : null}
      {query.error ? <p className="mt-4 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{query.error}</p> : null}
      {!settings ? (
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">設定を利用できません</h2>
          <p className="mt-2 text-stone-600">先に成人向けGrok Provider migrationを適用してください。</p>
        </section>
      ) : (
        <form action={updateCloudAdultGrokAction} className="panel mt-6 space-y-5">
          <div className="rounded-lg bg-violet-50 p-4">
            <p className="font-bold">
              利用状態: {settings.configured && settings.enabled ? "利用できます" : "APIキー未設定"}
            </p>
            <p className="mt-1 text-sm text-stone-600">最終更新: {new Date(settings.updatedAt).toLocaleString("ja-JP")}</p>
          </div>
          <label className="label block" htmlFor="apiKey">
            xAI APIキー
            <input
              autoComplete="new-password"
              className="field mt-2"
              id="apiKey"
              name="apiKey"
              placeholder={settings.configured ? "新しいAPIキーを入力して変更" : "xAI Consoleで発行したAPIキー"}
              required
              type="password"
            />
            <span className="mt-2 block text-sm font-normal text-stone-600">
              保存するとすぐ利用可能になります。変更時は新しいキーを入力して保存してください。
              キーはSupabase Vaultへ保存し、保存後は画面やログに表示しません。
            </span>
          </label>
          <button className="button w-full bg-violet-700 hover:bg-violet-800" type="submit">
            APIキーを保存して利用開始
          </button>
        </form>
      )}
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">設定変更履歴</h2>
        <p className="mt-2 text-sm text-stone-600">APIキー本体・一部文字・入力内容は記録しません。</p>
        <div className="mt-4 space-y-3">
          {(audits ?? []).map((audit) => (
            <article className="border-b pb-3 text-sm" key={audit.id}>
              <strong>{audit.action}</strong>
              <p>{audit.model}・{audit.enabled ? "有効" : "停止"}</p>
              <p className="text-stone-500">{new Date(audit.created_at).toLocaleString("ja-JP")}</p>
            </article>
          ))}
          {!audits?.length ? <p className="text-stone-500">設定変更履歴はありません。</p> : null}
        </div>
      </section>
    </main>
  );
}
