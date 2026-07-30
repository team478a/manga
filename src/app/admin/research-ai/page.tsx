import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getCloudResearchAiSettings } from "@/lib/cloud-research-ai-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateCloudResearchAiAction } from "./actions";

type Audit = {
  id: string;
  action: string;
  model: string;
  enabled: boolean;
  created_at: string;
};

export default async function ResearchAiAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const settings = await getCloudResearchAiSettings();
  const admin = createAdminClient();
  const { data: audits } = await admin
    .from("cloud_research_ai_audit_logs")
    .select("id,action,model,enabled,created_at")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<Audit[]>();

  return (
    <main className="page max-w-4xl">
      <Link className="text-violet-700 underline" href="/admin">
        ← 管理者ダッシュボード
      </Link>
      <h1 className="mt-4 text-3xl font-bold">一般向けAI（OpenAI）設定</h1>
      <p className="mt-2 text-stone-600">
        一般向けの市場分析・企画・シナリオ・ネームで共通利用するOpenAI接続です。
        APIキーはSupabase Vaultへ暗号化保存され、この画面や監査ログには再表示されません。
      </p>
      {query.message ? (
        <p className="mt-5 rounded-lg bg-green-50 p-4 text-green-800" role="status">
          {query.message}
        </p>
      ) : null}
      {query.error ? (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">
          {query.error}
        </p>
      ) : null}
      {!settings ? (
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">設定を利用できません</h2>
          <p className="mt-2 text-stone-600">
            先に市場分析AI Provider migrationを適用してください。未適用の間はAI分析を実行しません。
          </p>
        </section>
      ) : (
        <form action={updateCloudResearchAiAction} className="panel mt-6 space-y-5">
          <div className="rounded-lg bg-violet-50 p-4">
            <p className="font-bold">
              利用状態: {settings.configured && settings.enabled ? "利用できます" : "APIキー未設定"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              最終更新: {new Date(settings.updatedAt).toLocaleString("ja-JP")}
            </p>
          </div>
          <label className="label block" htmlFor="apiKey">
            OpenAI APIキー
            <input
              autoComplete="new-password"
              className="field mt-2"
              id="apiKey"
              name="apiKey"
              placeholder={
                settings.configured
                  ? "新しいAPIキーを入力して変更"
                  : "sk-... または sk-proj-..."
              }
              required
              type="password"
            />
            <span className="mt-2 block text-sm font-normal text-stone-600">
              保存するとすぐ利用可能になります。変更時は新しいキーを入力して保存してください。
              キーは保存後に表示せず、以前のキーは安全に上書きします。
            </span>
          </label>
          <button className="button w-full bg-violet-700 hover:bg-violet-800" type="submit">
            APIキーを保存して利用開始
          </button>
        </form>
      )}
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">設定変更履歴</h2>
        <p className="mt-2 text-sm text-stone-600">
          APIキー本体や末尾文字は記録しません。
        </p>
        <div className="mt-4 space-y-3">
          {(audits ?? []).map((audit) => (
            <article className="border-b pb-3 text-sm" key={audit.id}>
              <strong>{audit.action}</strong>
              <p>
                {audit.model}・{audit.enabled ? "有効" : "停止"}
              </p>
              <p className="text-stone-500">
                {new Date(audit.created_at).toLocaleString("ja-JP")}
              </p>
            </article>
          ))}
          {!audits?.length ? (
            <p className="text-stone-500">設定変更履歴はありません。</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
