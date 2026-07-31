import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createCloudAiPriceAction,
  setCloudAiPriceActiveAction,
  updateCloudGeneralImageProviderAction,
  updateCloudAiPlanAction,
  updateCloudAiSettingsAction,
} from "./actions";
import { getCloudGeneralImageSettings } from "@/lib/cloud-general-image-settings";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

const money = (micros: number) => `$${(micros / 1_000_000).toFixed(4)}`;

export default async function CloudAiAdminPage({searchParams}:{searchParams:Promise<{message?:string;error?:string}>}) {
  await requireAdmin();
  const query=await searchParams;
  const admin=createAdminClient();
  const [settingsResult,plansResult,pricesResult,costsResult,jobsResult,auditsResult,notificationsResult,imageSettings]=await Promise.all([
    admin.from("cloud_ai_settings").select("*").eq("singleton",true).single(),
    admin.from("cloud_ai_plans").select("*").order("plan_key"),
    admin.from("cloud_ai_provider_prices").select("*").order("created_at",{ascending:false}).limit(50),
    admin.from("cloud_ai_daily_costs").select("*").order("usage_date",{ascending:false}).limit(14),
    admin.from("cloud_generation_jobs").select("id,provider_id,model_id,job_type,status,error_code,error_message,actual_cost_micros,created_at").in("status",["failed","running"]).order("created_at",{ascending:false}).limit(30),
    admin.from("cloud_ai_admin_audit_logs").select("id,action,target_type,target_id,created_at,profiles:actor_profile_id(display_name)").order("created_at",{ascending:false}).limit(20),
    admin.from("cloud_ai_notifications").select("id,notification_type,severity,title,body,created_at").eq("audience","admin").order("created_at",{ascending:false}).limit(20),
    getCloudGeneralImageSettings(),
  ]);
  const settings=settingsResult.data as null|{generation_enabled:boolean;daily_cost_limit_micros:number;warning_percent:number};
  const today=costsResult.data?.[0] as undefined|{usage_date:string;cost_reserved_micros:number;cost_actual_micros:number};
  const percent=settings&&today&&settings.daily_cost_limit_micros>0?Math.round((today.cost_actual_micros/settings.daily_cost_limit_micros)*100):0;
  return <main className="page max-w-7xl">
    <Link className="text-leaf underline" href="/admin">← 管理者ダッシュボード</Link>
    <h1 className="mt-4 text-3xl font-bold">Cloud AI運用</h1>
    <p className="mt-2 text-stone-600">生成停止、予算、Plan、Provider価格、失敗Jobと監査履歴を管理します。</p>
    {query.message?<p className="mt-5 rounded bg-green-50 p-4 text-green-800">{query.message}</p>:null}
    {query.error?<p className="mt-5 rounded bg-red-50 p-4 text-red-700">{query.error}</p>:null}
    <div className="mt-6 grid gap-5 lg:grid-cols-3">
      <section className="panel lg:col-span-2">
        <h2 className="text-xl font-bold">全体設定・緊急停止</h2>
        {settings?<form action={updateCloudAiSettingsAction} className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="label">生成状態<select className="field" name="generationEnabled" defaultValue={String(settings.generation_enabled)}><option value="true">有効</option><option value="false">停止</option></select></label>
          <label className="label">日次上限（micro USD）<input className="field" name="dailyCostLimitMicros" type="number" min="0" defaultValue={settings.daily_cost_limit_micros}/></label>
          <label className="label">警告率（%）<input className="field" name="warningPercent" type="number" min="1" max="100" defaultValue={settings.warning_percent}/></label>
          <button className="button sm:col-span-3" type="submit">運用設定を保存</button>
        </form>:<p className="text-red-700">設定を読み込めません。</p>}
      </section>
      <section className="panel">
        <h2 className="text-xl font-bold">本日の原価</h2>
        <p className="mt-3 text-3xl font-bold">{money(today?.cost_actual_micros??0)}</p>
        <p className="mt-2 text-stone-600">予約 {money(today?.cost_reserved_micros??0)} / 上限 {money(settings?.daily_cost_limit_micros??0)}</p>
        <p className={`mt-3 font-semibold ${percent>=(settings?.warning_percent??80)?"text-red-700":"text-green-700"}`}>{percent}% 使用</p>
      </section>
    </div>
    <section className="panel mt-6">
      <h2 className="text-xl font-bold">一般向け画像生成AI</h2>
      <p className="mt-2 text-stone-600">
        Black Forest Labs FLUXを一般向けマンガのコマ画像生成に使用します。APIキーはSupabase Vaultへ暗号化保存され、この画面や監査ログには再表示されません。
      </p>
      {imageSettings ? (
        <form action={updateCloudGeneralImageProviderAction} className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="label">
            BFL APIキー
            <input
              autoComplete="off"
              className="field"
              name="apiKey"
              placeholder={imageSettings.configured ? "変更時のみ入力" : "APIキーを入力"}
              type="password"
            />
          </label>
          <label className="label">
            画像モデル
            <select className="field" name="model" defaultValue={imageSettings.model}>
              <option value="flux-2-klein-9b">FLUX.2 Klein 9B（低コスト）</option>
              <option value="flux-2-pro">FLUX.2 Pro（推奨）</option>
              <option value="flux-2-max">FLUX.2 Max（高品質）</option>
            </select>
          </label>
          <label className="label">
            接続状態
            <select className="field" name="enabled" defaultValue={String(imageSettings.enabled)}>
              <option value="true">有効</option>
              <option value="false">停止</option>
            </select>
          </label>
          <p className="text-sm text-stone-600 md:col-span-3">
            現在: {imageSettings.configured ? "APIキー設定済み" : "未設定"} / {imageSettings.enabled ? "有効" : "停止"}。成人向け画像はこの接続へ送信されません。
          </p>
          <PendingSubmitButton
            className="button md:col-span-3"
            pendingLabel="画像生成AI設定を保存中…"
          >
            画像生成AI設定を保存
          </PendingSubmitButton>
        </form>
      ) : (
        <p className="mt-4 rounded bg-amber-50 p-4 text-amber-900">
          画像生成Provider migrationを適用すると設定できます。
        </p>
      )}
    </section>
    <section className="mt-6 grid gap-4 lg:grid-cols-3">
      {(plansResult.data??[]).map((plan:any)=><form className="panel" action={updateCloudAiPlanAction.bind(null,plan.plan_key)} key={plan.plan_key}>
        <h2 className="text-xl font-bold">{plan.display_name}</h2>
        <label className="label mt-3 block">月間credit<input className="field" name="monthlyCredits" type="number" defaultValue={plan.monthly_credits}/></label>
        <label className="label mt-3 block">月間原価上限（micro USD）<input className="field" name="monthlyCostLimitMicros" type="number" defaultValue={plan.monthly_cost_limit_micros}/></label>
        <div className="mt-3 grid grid-cols-2 gap-3"><label className="label">User/分<input className="field" name="userRate" type="number" defaultValue={plan.user_requests_per_minute}/></label><label className="label">Project/分<input className="field" name="projectRate" type="number" defaultValue={plan.project_requests_per_minute}/></label></div>
        <label className="label mt-3 block">状態<select className="field" name="active" defaultValue={String(plan.active)}><option value="true">有効</option><option value="false">停止</option></select></label>
        <button className="button mt-4 w-full" type="submit">Planを保存</button>
      </form>)}
    </section>
    <section className="panel mt-6"><h2 className="text-xl font-bold">Provider価格versionを追加</h2>
      <form action={createCloudAiPriceAction} className="mt-4 grid gap-3 md:grid-cols-4">
        <input className="field" name="providerId" placeholder="Provider ID" required/><input className="field" name="modelId" placeholder="Model ID" required/>
        <select className="field" name="kind"><option value="image">image</option><option value="text">text</option></select>
        <select className="field" name="jobType">{["background","prop","effect","character_base","story","storyboard","speech_bubble"].map(v=><option key={v}>{v}</option>)}</select>
        <input className="field" name="pricingVersion" placeholder="pricing version" required/><input className="field" name="credits" type="number" min="1" placeholder="credit" required/><input className="field" name="maxCostMicros" type="number" min="0" placeholder="最大原価 micro" required/><input className="field" name="currency" defaultValue="USD" required/>
        <button className="button md:col-span-4" type="submit">停止状態で登録</button>
      </form>
      <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Provider / Model</th><th>Job</th><th>Version</th><th>credit</th><th>最大原価</th><th>状態</th></tr></thead><tbody>{(pricesResult.data??[]).map((price:any)=><tr className="border-t" key={price.id}><td className="py-3">{price.provider_id}<br/>{price.model_id}</td><td>{price.kind}/{price.job_type}</td><td>{price.pricing_version}</td><td>{price.credits}</td><td>{money(price.max_cost_micros)}</td><td><form action={setCloudAiPriceActiveAction.bind(null,price.id,!price.active)}><button className="button-secondary" type="submit">{price.active?"停止":"有効化"}</button></form></td></tr>)}</tbody></table></div>
    </section>
    <section className="panel mt-6"><h2 className="text-xl font-bold">運用通知</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{(notificationsResult.data??[]).map((notice:any)=><article className={`rounded border p-3 ${notice.severity==="critical"?"border-red-300 bg-red-50":"border-amber-300 bg-amber-50"}`} key={notice.id}><strong>{notice.title}</strong><p className="mt-1 text-sm">{notice.body}</p><p className="mt-2 text-xs text-stone-500">{new Date(notice.created_at).toLocaleString("ja-JP")}</p></article>)}{!notificationsResult.data?.length?<p className="text-stone-500">運用通知はありません。</p>:null}</div></section>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="panel"><h2 className="text-xl font-bold">失敗・実行中Job</h2><div className="mt-4 space-y-3">{(jobsResult.data??[]).map((job:any)=><div className="rounded border p-3 text-sm" key={job.id}><strong>{job.status}・{job.provider_id}/{job.model_id}</strong><p>{job.job_type}・{job.error_code??"errorなし"}</p><p className="text-stone-500">{job.error_message??job.id}</p></div>)}{!jobsResult.data?.length?<p className="text-stone-500">対象Jobはありません。</p>:null}</div></section>
      <section className="panel"><h2 className="text-xl font-bold">管理操作監査</h2><div className="mt-4 space-y-3">{(auditsResult.data??[]).map((log:any)=><div className="border-b pb-3 text-sm" key={log.id}><strong>{log.action}</strong><p>{log.target_type} / {log.target_id}</p><p className="text-stone-500">{new Date(log.created_at).toLocaleString("ja-JP")}</p></div>)}</div></section></div>
  </main>;
}
