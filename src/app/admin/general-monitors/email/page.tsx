import Link from "next/link";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireAdmin } from "@/lib/auth";
import { getCloudGeneralMonitorEmailSettings } from "@/lib/cloud-general-monitor-email-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateGeneralMonitorEmailSettingsAction } from "./actions";

type Audit = {
  id: string;
  action: string;
  from_email: string;
  created_at: string;
};

export default async function GeneralMonitorEmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const settings = await getCloudGeneralMonitorEmailSettings();
  const { data: audits } = await createAdminClient()
    .from("cloud_general_monitor_email_audit_logs")
    .select("id,action,from_email,created_at")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<Audit[]>();

  return (
    <main className="page max-w-4xl">
      <Link className="text-violet-700 underline" href="/admin/general-monitors">
        ← モニター管理
      </Link>
      <h1 className="mt-4 text-3xl font-bold">招待メール（Resend）設定</h1>
      <p className="mt-2 text-stone-600">
        APIキーを入力して保存すると、モニター招待と再送に利用できます。
        APIキーはSupabase Vaultへ暗号化保存し、画面や監査ログへ再表示しません。
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
            先に一般向けモニターEmail Provider migrationを適用してください。
          </p>
        </section>
      ) : (
        <form
          action={updateGeneralMonitorEmailSettingsAction}
          className="panel mt-6 space-y-5"
        >
          <div className="rounded-lg bg-violet-50 p-4">
            <p className="font-bold">
              利用状態:{" "}
              {settings.configured && settings.enabled
                ? "利用できます"
                : "APIキー未設定"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              最終更新: {new Date(settings.updatedAt).toLocaleString("ja-JP")}
            </p>
          </div>
          <label className="label block" htmlFor="apiKey">
            Resend APIキー
            <input
              autoComplete="new-password"
              className="field mt-2"
              id="apiKey"
              name="apiKey"
              placeholder={
                settings.configured
                  ? "新しいAPIキーを入力して変更"
                  : "re_..."
              }
              required
              type="password"
            />
          </label>
          <label className="label block" htmlFor="fromEmail">
            送信元メールアドレス
            <input
              className="field mt-2"
              defaultValue={settings.fromEmail}
              id="fromEmail"
              name="fromEmail"
              placeholder="monitor@example.com"
              required
              type="email"
            />
          </label>
          <label className="label block" htmlFor="fromName">
            送信者名
            <input
              className="field mt-2"
              defaultValue={settings.fromName}
              id="fromName"
              maxLength={80}
              name="fromName"
              required
            />
          </label>
          <PendingSubmitButton
            className="button w-full bg-violet-700 hover:bg-violet-800"
            pendingLabel="設定を保存中…"
          >
            APIキーを保存して利用開始
          </PendingSubmitButton>
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
              <p>{audit.from_email}</p>
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
