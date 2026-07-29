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
      <h1 className="mt-4 text-3xl font-bold">市場分析AI設定</h1>
      <p className="mt-2 text-stone-600">
        一般向け市場分析で利用するOpenAI接続を管理します。APIキーはSupabase
        Vaultへ暗号化保存され、この画面や監査ログには再表示されません。
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
              APIキー: {settings.configured ? "設定済み" : "未設定"}
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
                  ? "変更しない場合は空欄"
                  : "sk-... または sk-proj-..."
              }
              type="password"
            />
            <span className="mt-2 block text-sm font-normal text-stone-600">
              入力した値は保存後に確認できません。交換すると以前のキーは上書きされます。
            </span>
          </label>
          <label className="label block" htmlFor="model">
            モデル
            <select
              className="field mt-2"
              defaultValue={settings.model}
              id="model"
              name="model"
            >
              <option value="gpt-5.6-terra">GPT-5.6 Terra（推奨）</option>
              <option value="gpt-5.6-sol">GPT-5.6 Sol（高精度）</option>
              <option value="gpt-5.6-luna">GPT-5.6 Luna（低コスト）</option>
            </select>
          </label>
          <label className="label block" htmlFor="enabled">
            実行状態
            <select
              className="field mt-2"
              defaultValue={String(settings.enabled)}
              id="enabled"
              name="enabled"
            >
              <option value="false">停止</option>
              <option value="true">有効</option>
            </select>
          </label>
          <button className="button w-full bg-violet-700 hover:bg-violet-800" type="submit">
            安全に保存
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
