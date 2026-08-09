import Link from "next/link";
import { AdminDataUnavailable } from "@/components/admin/AdminDataUnavailable";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { requireAdmin } from "@/lib/auth";
import {
  createCloudAiPriceAction,
  cancelCloudAiJobAction,
  runCloudAiWorkerOnceAction,
  setCloudAiPriceActiveAction,
  updateCloudAiPlanAction,
  updateCloudAiSettingsAction,
} from "./actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { getCloudAiWorkerConfiguration } from "@/modules/cloud-ai/presentation/admin-actions";
import { getCloudAiWorkerHealth } from "@/lib/cloud-ai-worker-health";
import { loadCloudAiAdminWorkspace } from "@/modules/cloud-ai/infrastructure/admin-cloud-ai-repository";

export const maxDuration = 180;

const money = (micros: number) => `$${(micros / 1_000_000).toFixed(4)}`;

const jobStatusLabel: Record<string, string> = {
  queued: "処理待ち",
  running: "実行中",
  failed: "失敗",
};

function elapsedLabel(value: string) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (elapsedMinutes < 60) return `${elapsedMinutes}分前`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

export default async function CloudAiAdminPage({searchParams}:{searchParams:Promise<{message?:string;error?:string}>}) {
  await requireAdmin();
  const query=await searchParams;
  const checkedAt=new Date();
  const failedSince=new Date(checkedAt.getTime()-24*60*60*1000).toISOString();
  const loaded=await safelyLoadAdminData("cloud-ai",()=>loadCloudAiAdminWorkspace({checkedAt:checkedAt.toISOString(),failedSince}));
  if(!loaded.ok)return <AdminDataUnavailable title="Cloud AI運用"/>;
  const [settingsResult,plansResult,pricesResult,costsResult,jobsResult,auditsResult,notificationsResult,imageSettings,queuedResult,runningResult,failedResult,recentFailedResult,staleLeaseResult,oldestQueuedResult]=loaded.value;
  const workerConfiguration=getCloudAiWorkerConfiguration();
  const workerHealth=getCloudAiWorkerHealth({workerReady:workerConfiguration.ready,queued:queuedResult.count??0,running:runningResult.count??0,failedLast24Hours:recentFailedResult.count??0,staleLeases:staleLeaseResult.count??0,oldestQueuedAt:oldestQueuedResult.data?.created_at,now:checkedAt});
  const healthClass={stopped:"border-stone-300 bg-stone-50 text-stone-800",critical:"border-red-300 bg-red-50 text-red-900",warning:"border-amber-300 bg-amber-50 text-amber-900",active:"border-blue-300 bg-blue-50 text-blue-900",idle:"border-green-300 bg-green-50 text-green-900"}[workerHealth.status];
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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold">Cloud AI Worker</h2>
          <p className="mt-2 text-stone-600">
            Cloud AI Queueの状態を確認し、診断目的で待機中Jobを1件だけ処理します。署名Secretはブラウザーへ表示されません。
          </p>
        </div>
        <Link className="button-secondary whitespace-nowrap" href="/admin/general-monitors/readiness">
          公開チェックを確認
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-violet-50 p-4"><p className="text-sm text-stone-600">処理待ち</p><p className="mt-1 text-2xl font-bold text-violet-700">{queuedResult.count??0}</p></div>
        <div className="rounded-lg bg-blue-50 p-4"><p className="text-sm text-stone-600">実行中</p><p className="mt-1 text-2xl font-bold text-blue-700">{runningResult.count??0}</p></div>
        <div className="rounded-lg bg-red-50 p-4"><p className="text-sm text-stone-600">失敗</p><p className="mt-1 text-2xl font-bold text-red-700">{failedResult.count??0}</p></div>
      </div>
      <div className={`mt-4 rounded-lg border p-4 ${healthClass}`} role="status">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><strong>稼働状態: {workerHealth.label}</strong><span className="text-sm">24時間以内の失敗 {recentFailedResult.count??0}件 / 期限切れ処理 {staleLeaseResult.count??0}件</span></div>
        <p className="mt-2 text-sm">{workerHealth.message}</p>
      </div>
      {workerConfiguration.ready ? (
        <form action={runCloudAiWorkerOnceAction} className="mt-5">
          <PendingSubmitButton className="button" pendingLabel="Workerを実行中…">
            待機中Jobを1件実行
          </PendingSubmitButton>
          <p className="mt-3 text-sm text-stone-600">
            この操作は診断用です。継続運用では認証付きSchedulerを別途稼働させてください。
          </p>
        </form>
      ) : (
        <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          Workerは停止中です。公開チェック画面の手順に沿って環境変数を設定し、再デプロイしてください。
        </p>
      )}
      <div className="mt-5 rounded-lg border border-violet-200 bg-violet-50 p-4">
        <h3 className="font-bold text-violet-950">定期実行Scheduler</h3>
        <p className="mt-2 text-sm text-violet-900">
          最初は「check」を実行すると、Workerへ通信せずActions側のURLとSecret設定だけを確認できます。
          「run」は設定確認後の限定テストでのみ選択してください。
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a
            className="button-secondary"
            href="https://github.com/team478a/manga/actions/workflows/cloud-ai-worker-scheduler.yml"
            rel="noreferrer"
            target="_blank"
          >
            Scheduler設定確認を開く
          </a>
          <Link className="button-secondary" href="/admin/general-monitors/readiness">
            本番公開チェックを開く
          </Link>
        </div>
        <p className="mt-3 text-xs text-violet-800">
          Actions側の設定値や実行結果はこの画面へ取得せず、秘密情報の境界を維持します。
        </p>
      </div>
    </section>
    <section className="panel mt-6">
      <h2 className="text-xl font-bold">一般向け画像生成AI</h2>
      <p className="mt-2 text-stone-600">
        Black Forest Labs FLUXを一般向けマンガのコマ画像生成に使用します。APIキーはSupabase Vaultへ暗号化保存され、この画面や監査ログには再表示されません。
      </p>
      {imageSettings ? (
        <div className="mt-4">
          <p className="text-sm text-stone-600">
            現在: {imageSettings.configured ? "APIキー設定済み" : "未設定"} / {imageSettings.enabled ? "有効" : "停止"}。成人向け画像はこの接続へ送信されません。
          </p>
          <Link className="button-secondary mt-4 inline-flex" href="/admin/provider-settings#bfl">
            外部API設定で変更
          </Link>
        </div>
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
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="panel"><h2 className="text-xl font-bold">生成Jobの確認・取消</h2><p className="mt-2 text-sm text-stone-600">処理待ち・実行中・失敗Jobを確認できます。失敗Jobの再生成は作品編集画面から行ってください。</p><div className="mt-4 space-y-3">{(jobsResult.data??[]).map((job:any)=><article className="rounded border p-4 text-sm" key={job.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><strong>{jobStatusLabel[job.status]??job.status}・{job.job_type}</strong><p className="mt-1 text-stone-700">作品: {job.project?.title??"名称未取得"} / 利用者: {job.owner?.display_name??"名称未取得"}</p><p className="mt-1 text-stone-500">{job.provider_id}/{job.model_id}・試行 {job.attempt_count}/{job.max_attempts}・{elapsedLabel(job.updated_at??job.created_at)}</p>{job.status==="failed"?<p className="mt-2 rounded bg-red-50 px-3 py-2 text-red-800">処理に失敗しました（{job.error_code??"原因未分類"}）。利用者は作品編集画面から対象だけを再生成できます。</p>:null}</div>{["queued","running"].includes(job.status)?<form action={cancelCloudAiJobAction.bind(null,job.id)}><PendingSubmitButton className="button-secondary whitespace-nowrap" pendingLabel="取消中…">Jobを取消</PendingSubmitButton></form>:null}</div><details className="mt-3"><summary className="cursor-pointer text-stone-600">管理用IDを表示</summary><p className="mt-2 break-all font-mono text-xs text-stone-500">{job.id}</p></details></article>)}{!jobsResult.data?.length?<p className="text-stone-500">対象Jobはありません。</p>:null}</div></section>
      <section className="panel"><h2 className="text-xl font-bold">管理操作監査</h2><div className="mt-4 space-y-3">{(auditsResult.data??[]).map((log:any)=><div className="border-b pb-3 text-sm" key={log.id}><strong>{log.action}</strong><p>{log.target_type} / {log.target_id}</p><p className="text-stone-500">{new Date(log.created_at).toLocaleString("ja-JP")}</p></div>)}</div></section></div>
  </main>;
}
