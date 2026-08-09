import Link from "next/link";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { AdminDataUnavailable } from "@/components/admin/AdminDataUnavailable";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireAdmin } from "@/lib/auth";
import { getCloudGeneralMonitorEmailSettings } from "@/lib/cloud-general-monitor-email-settings";
import { loadGeneralMonitorEmailAudits } from "@/modules/general-monitor/infrastructure/admin-monitor-repository";
import {
  updateGeneralMonitorEmailTemplateAction,
} from "./actions";

export default async function GeneralMonitorEmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const loaded = await safelyLoadAdminData("general-monitors/email", async () => {
    const settings = await getCloudGeneralMonitorEmailSettings();
    const audits = await loadGeneralMonitorEmailAudits();
    return { settings, audits };
  });
  if (!loaded.ok) return <AdminDataUnavailable title="招待メール設定" />;
  const { settings, audits } = loaded.value;

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
        <InlineErrorMessage radius="lg" role="alert">
          {query.error}
        </InlineErrorMessage>
      ) : null}
      {!settings ? (
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">設定を利用できません</h2>
          <p className="mt-2 text-stone-600">
            先に一般向けモニターEmail Provider migrationを適用してください。
          </p>
        </section>
      ) : (
        <>
          <section className="panel mt-6 space-y-5">
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
            <p className="text-sm text-stone-600">
              APIキーと送信元情報は外部API設定へ集約しました。この画面では招待メールの文面だけを編集します。
            </p>
            <Link className="button-secondary inline-flex" href="/admin/provider-settings#resend">
              外部API設定で変更
            </Link>
          </section>
          {settings.templateAvailable ? (
            <form
              action={updateGeneralMonitorEmailTemplateAction}
              className="panel mt-6 space-y-5"
            >
              <div>
                <h2 className="text-xl font-bold">招待メールの文面</h2>
                <p className="mt-2 text-sm text-stone-600">
                  APIキーを再入力せず、次回送信分から件名と本文を変更できます。
                  メールはプレーンテキストで送信されます。
                </p>
              </div>
              <label className="label block" htmlFor="subjectTemplate">
                件名
                <input
                  className="field mt-2"
                  defaultValue={settings.subjectTemplate}
                  id="subjectTemplate"
                  maxLength={120}
                  name="subjectTemplate"
                  required
                />
              </label>
              <label className="label block" htmlFor="bodyTemplate">
                本文
                <textarea
                  className="field mt-2 min-h-80 font-mono text-sm"
                  defaultValue={settings.bodyTemplate}
                  id="bodyTemplate"
                  maxLength={5000}
                  name="bodyTemplate"
                  required
                />
              </label>
              <div className="rounded-lg bg-stone-50 p-4 text-sm text-stone-700">
                <p className="font-bold">利用できる差し込み項目</p>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  <li><code>{"{{recipient_name}}"}</code> 宛名</li>
                  <li><code>{"{{welcome_url}}"}</code> 利用開始URL（必須）</li>
                  <li><code>{"{{expires_on}}"}</code> 利用期限</li>
                  <li><code>{"{{ai_request_limit}}"}</code> AI利用上限</li>
                </ul>
              </div>
              <PendingSubmitButton
                className="button w-full bg-violet-700 hover:bg-violet-800"
                pendingLabel="文面を保存中…"
              >
                件名と本文を保存
              </PendingSubmitButton>
            </form>
          ) : (
            <section className="panel mt-6">
              <h2 className="text-xl font-bold">招待メールの文面</h2>
              <p className="mt-2 text-stone-600">
                文面編集migrationを適用すると、件名と本文を管理画面から変更できます。
              </p>
            </section>
          )}
        </>
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
