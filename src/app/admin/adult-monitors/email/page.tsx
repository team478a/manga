import Link from "next/link";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireAdmin } from "@/lib/auth";
import { getCloudGeneralMonitorEmailSettings } from "@/lib/cloud-general-monitor-email-settings";
import { updateAdultMonitorEmailTemplateAction } from "./actions";

export default async function AdultMonitorEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const settings = await getCloudGeneralMonitorEmailSettings();
  return (
    <main className="page max-w-4xl">
      <Link className="text-violet-700 underline" href="/admin/adult-monitors">← 成人向けモニター管理</Link>
      <p className="mt-5 font-semibold text-violet-700">Resend共通送信設定を利用</p>
      <h1 className="mt-1 text-3xl font-bold">成人向け招待メール</h1>
      <p className="mt-2 text-stone-600">
        一般向け招待メールと同じ送信元・APIキーを使い、成人向け専用の件名と本文だけを管理します。
      </p>
      {query.message ? <p className="mt-5 rounded-lg bg-green-50 p-4 text-green-800" role="status">{query.message}</p> : null}
      {query.error ? <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{query.error}</p> : null}
      {!settings?.configured ? (
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">先に送信設定が必要です</h2>
          <p className="mt-2 text-stone-600">Resend APIキーと認証済み送信元を保存してください。</p>
          <Link className="button-secondary mt-4" href="/admin/general-monitors/email">送信設定を開く</Link>
        </section>
      ) : (
        <form action={updateAdultMonitorEmailTemplateAction} className="panel mt-6 space-y-5">
          <label className="label block" htmlFor="subjectTemplate">
            件名
            <input className="field mt-2" defaultValue={settings.adultSubjectTemplate} id="subjectTemplate" maxLength={120} name="subjectTemplate" required />
          </label>
          <label className="label block" htmlFor="bodyTemplate">
            本文
            <textarea className="field mt-2 min-h-96 font-mono text-sm" defaultValue={settings.adultBodyTemplate} id="bodyTemplate" maxLength={5000} name="bodyTemplate" required />
          </label>
          <div className="rounded-lg bg-stone-50 p-4 text-sm text-stone-700">
            利用可能: <code>{"{{recipient_name}}"}</code> <code>{"{{welcome_url}}"}</code> <code>{"{{expires_on}}"}</code> <code>{"{{ai_request_limit}}"}</code>
          </div>
          <PendingSubmitButton className="button w-full bg-violet-700 hover:bg-violet-800" pendingLabel="文面を保存中…">
            成人向けの件名と本文を保存
          </PendingSubmitButton>
        </form>
      )}
    </main>
  );
}
