import Link from "next/link";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { AdminDataUnavailable } from "@/components/admin/AdminDataUnavailable";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { requireAdmin } from "@/lib/auth";
import { getCloudGeneralImageSettings } from "@/lib/cloud-general-image-settings";
import { getCloudGeneralMonitorEmailSettings } from "@/lib/cloud-general-monitor-email-settings";
import { getCloudResearchAiSettings } from "@/lib/cloud-research-ai-settings";
import {
  updateImageProviderAction,
  updateOpenAiProviderAction,
  updateResendProviderAction,
} from "./actions";

const externalLink = "text-violet-700 underline underline-offset-2";

export default async function ProviderSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const loaded = await safelyLoadAdminData("provider-settings", () =>
    Promise.all([
      getCloudResearchAiSettings(),
      getCloudGeneralImageSettings(),
      getCloudGeneralMonitorEmailSettings(),
    ]),
  );
  if (!loaded.ok) return <AdminDataUnavailable title="外部API設定" />;
  const [openAi, image, resend] = loaded.value;

  return (
    <main className="page max-w-5xl">
      <Link className="text-violet-700 underline" href="/admin">← 管理者ダッシュボード</Link>
      <h1 className="mt-4 text-3xl font-bold">外部API設定</h1>
      <p className="mt-2 text-stone-600">
        OpenAI、Black Forest Labs、ResendのAPIキーをこの画面で一括管理します。キーはSupabase Vaultへ暗号化保存し、保存後は再表示しません。
      </p>
      {query.message ? <p className="mt-5 rounded-lg bg-green-50 p-4 text-green-800" role="status">{query.message}</p> : null}
      {query.error ? <InlineErrorMessage radius="lg" role="alert">{query.error}</InlineErrorMessage> : null}

      <section className="panel mt-6 scroll-mt-6" id="openai">
        <h2 className="text-xl font-bold">1. OpenAI（市場分析）</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-6 text-sm text-stone-700">
          <li><a className={externalLink} href="https://platform.openai.com/api-keys" rel="noreferrer" target="_blank">OpenAIのAPI Keys</a>を開き、対象Projectを確認します。</li>
          <li>「Create new secret key」でキーを作成し、その場でコピーします。</li>
          <li>下欄へ貼り付け、モデルと実行状態を選んで保存します。</li>
        </ol>
        {openAi ? <form action={updateOpenAiProviderAction} className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="label">OpenAI APIキー<input autoComplete="new-password" className="field" name="apiKey" placeholder={openAi.configured ? "変更時のみ入力" : "sk-..."} type="password" /></label>
          <label className="label">モデル<select className="field" defaultValue={openAi.model} name="model"><option value="gpt-5.6-terra">GPT-5.6 Terra（推奨）</option><option value="gpt-5.6-sol">GPT-5.6 Sol（高精度）</option><option value="gpt-5.6-luna">GPT-5.6 Luna（低コスト）</option></select></label>
          <label className="label">実行状態<select className="field" defaultValue={String(openAi.enabled)} name="enabled"><option value="false">停止</option><option value="true">有効</option></select></label>
          <p className="text-sm text-stone-600 md:col-span-3">現在: {openAi.configured ? "設定済み" : "未設定"} / {openAi.enabled ? "有効" : "停止"}</p>
          <PendingSubmitButton className="button md:col-span-3" pendingLabel="OpenAI設定を保存中…">OpenAI設定を保存</PendingSubmitButton>
        </form> : <Unavailable />}
      </section>

      <section className="panel mt-6 scroll-mt-6" id="bfl">
        <h2 className="text-xl font-bold">2. Black Forest Labs（画像生成）</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-6 text-sm text-stone-700">
          <li><a className={externalLink} href="https://api.bfl.ai/" rel="noreferrer" target="_blank">BFL API Console</a>へログインし、Projectを作成または選択します。</li>
          <li>Projectサイドバーの「API → Keys」で「Add Key」を押し、表示されたキーをコピーします。</li>
          <li>必要に応じてcreditsを購入し、下欄へキーを貼り付けて保存します。<a className={`${externalLink} ml-1`} href="https://docs.bfl.ai/quick_start/get_started" rel="noreferrer" target="_blank">公式手順</a></li>
        </ol>
        {image ? <form action={updateImageProviderAction} className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="label">BFL APIキー<input autoComplete="new-password" className="field" name="apiKey" placeholder={image.configured ? "変更時のみ入力" : "APIキーを入力"} type="password" /></label>
          <label className="label">画像モデル<select className="field" defaultValue={image.model} name="model"><option value="flux-2-klein-9b">FLUX.2 Klein 9B（低コスト）</option><option value="flux-2-pro">FLUX.2 Pro（推奨）</option><option value="flux-2-max">FLUX.2 Max（高品質）</option></select></label>
          <label className="label">接続状態<select className="field" defaultValue={String(image.enabled)} name="enabled"><option value="false">停止</option><option value="true">有効</option></select></label>
          <p className="text-sm text-stone-600 md:col-span-3">現在: {image.configured ? "設定済み" : "未設定"} / {image.enabled ? "有効" : "停止"}。成人向け画像は送信されません。</p>
          <PendingSubmitButton className="button md:col-span-3" pendingLabel="画像生成AI設定を保存中…">画像生成AI設定を保存</PendingSubmitButton>
        </form> : <Unavailable />}
      </section>

      <section className="panel mt-6 scroll-mt-6" id="resend">
        <h2 className="text-xl font-bold">3. Resend（招待メール）</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-6 text-sm text-stone-700">
          <li><a className={externalLink} href="https://resend.com/api-keys" rel="noreferrer" target="_blank">ResendのAPI Keys</a>を開き「Create API Key」を押します。</li>
          <li>権限は「Sending access」を選び、送信に使う認証済みdomainへ制限して作成・コピーします。</li>
          <li>下欄へキー、認証済みdomainの送信元メールアドレス、送信者名を入力して保存します。</li>
        </ol>
        {resend ? <form action={updateResendProviderAction} className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="label">Resend APIキー<input autoComplete="new-password" className="field" name="apiKey" placeholder={resend.configured ? "新しいキーへ変更" : "re_..."} required type="password" /></label>
          <label className="label">送信元メールアドレス<input className="field" defaultValue={resend.fromEmail} name="fromEmail" required type="email" /></label>
          <label className="label">送信者名<input className="field" defaultValue={resend.fromName} maxLength={80} name="fromName" required /></label>
          <p className="text-sm text-stone-600 md:col-span-3">現在: {resend.configured && resend.enabled ? "利用可能" : "未設定"}</p>
          <PendingSubmitButton className="button md:col-span-3" pendingLabel="Resend設定を保存中…">Resend設定を保存</PendingSubmitButton>
        </form> : <Unavailable />}
      </section>
    </main>
  );
}

function Unavailable() {
  return <p className="mt-4 rounded bg-amber-50 p-4 text-amber-900">対応するProvider migrationを適用すると設定できます。</p>;
}
