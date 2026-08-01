import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BookOpen, CheckCircle2, Database, GitBranch, Users, WalletCards } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getCloudLongformCockpit } from "@/lib/cloud-creator-server";
import { CockpitStructure } from "./CockpitStructure";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { isProjectUsageWarning, usagePercent } from "@/lib/cloud-project-budget";
import { saveCloudProjectBudgetAction } from "./actions";

const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
const usd = (micros: number) => (micros / 1_000_000).toFixed(2);

export default async function LongformCockpitPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ message?: string; error?: string }> }) {
  await requireProfile();
  const { projectId } = await params;
  const query = await searchParams;
  const data = await getCloudLongformCockpit(projectId).catch(() => null);
  if (!data) notFound();
  const { project, cockpit } = data;
  return (
    <main className="page min-w-0">
      <Link className="text-violet-700 underline" href={`/creator/${projectId}`}>← 作品編集へ</Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-violet-700">長編作品コックピット</p>
          <h1 className="mt-1 break-words text-3xl font-bold">{project.title}</h1>
          <p className="mt-2 text-stone-600">章・シーン・ページ進捗・伏線・人物関係を一画面で確認します。</p>
        </div>
        <Link className="button w-fit" href={`/creator/${projectId}/continuity`}>一貫性台帳を編集</Link>
      </div>
      {query.message ? <p className="mt-4 rounded-lg bg-green-50 p-4 text-green-900" role="status">{query.message}</p> : null}
      {query.error ? <p className="mt-4 rounded-lg bg-red-50 p-4 text-red-900" role="alert">{query.error}</p> : null}

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="作品進捗">
        {[
          ["完成率", `${cockpit.completionPercent}%`], ["全ページ", cockpit.totalPages],
          ["確定", cockpit.finalizedPages], ["生成中", cockpit.generatingPages],
          ["確認・修正待ち", cockpit.reviewPages],
        ].map(([label, value]) => (
          <div className="min-w-0 rounded-xl border border-violet-100 bg-white p-4 shadow-sm" key={label}>
            <p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-2xl font-bold text-violet-800">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="章の制作計画">
        <div className="rounded-xl border border-red-100 bg-white p-4"><p className="text-xs text-stone-500">期限超過</p><p className="mt-1 text-2xl font-bold text-red-700">{cockpit.overdueChapterCount}章</p></div>
        <div className="rounded-xl border border-amber-100 bg-white p-4"><p className="text-xs text-stone-500">優先度 高以上</p><p className="mt-1 text-2xl font-bold text-amber-800">{cockpit.priorityChapterCount}章</p></div>
        <div className="rounded-xl border border-violet-100 bg-white p-4"><p className="text-xs text-stone-500">次に着手</p><p className="mt-1 break-words text-lg font-bold text-violet-800">{cockpit.nextChapter?.title ?? "全章完了"}</p></div>
      </section>

      <section className="panel mt-6 min-w-0" aria-labelledby="resource-heading">
        <h2 className="flex items-center gap-2 text-xl font-bold" id="resource-heading"><WalletCards className="h-5 w-5 text-violet-700" />作品の生成量・費用・容量</h2>
        {!data.resourceBudgetAvailable || !data.resourceUsage ? <p className="mt-4 rounded-lg bg-amber-50 p-4 text-amber-900">作品別上限migrationの適用後に利用状況と自動停止を利用できます。</p> : (() => {
          const usage = data.resourceUsage;
          const creditTotal = usage.credits_used + usage.credits_reserved;
          const costTotal = usage.cost_actual_micros + usage.cost_reserved_micros;
          const warnings = [
            isProjectUsageWarning(creditTotal, usage.monthly_credit_limit, usage.warning_percent),
            isProjectUsageWarning(costTotal, usage.monthly_cost_limit_micros, usage.warning_percent),
            isProjectUsageWarning(usage.storage_bytes, usage.storage_limit_bytes, usage.warning_percent),
          ];
          const meters: Array<[string, number, number | null]> = [
            ["生成credit", creditTotal, usage.monthly_credit_limit],
            ["推定費用", costTotal, usage.monthly_cost_limit_micros],
            ["保存容量", usage.storage_bytes, usage.storage_limit_bytes],
          ];
          return <>
            {!usage.generation_enabled ? <p className="mt-4 rounded-lg bg-red-50 p-4 font-bold text-red-900" role="alert">この作品のAI生成は停止中です。</p> : warnings.some(Boolean) ? <p className="mt-4 rounded-lg bg-amber-50 p-4 text-amber-900" role="status">設定した警告ラインへ近づいています。上限と残量を確認してください。</p> : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-violet-50 p-4"><p className="text-xs text-stone-600">今月の生成credit</p><p className="mt-1 text-xl font-bold">{creditTotal}{usage.monthly_credit_limit ? ` / ${usage.monthly_credit_limit}` : ""}</p><p className="mt-1 text-xs text-stone-600">完了 {usage.credits_used}・予約中 {usage.credits_reserved}</p></div>
              <div className="rounded-xl bg-violet-50 p-4"><p className="text-xs text-stone-600">今月の推定費用</p><p className="mt-1 text-xl font-bold">${usd(costTotal)}{usage.monthly_cost_limit_micros ? ` / $${usd(usage.monthly_cost_limit_micros)}` : ""}</p><p className="mt-1 text-xs text-stone-600">Provider単価・モデル情報は表示しません</p></div>
              <div className="rounded-xl bg-violet-50 p-4"><p className="text-xs text-stone-600">作品の保存容量</p><p className="mt-1 text-xl font-bold">{mb(usage.storage_bytes)} MB{usage.storage_limit_bytes ? ` / ${mb(usage.storage_limit_bytes)} MB` : ""}</p><p className="mt-1 text-xs text-stone-600">採用前候補を含む保存済み素材</p></div>
              <div className="rounded-xl bg-violet-50 p-4"><p className="text-xs text-stone-600">生成Job</p><p className="mt-1 text-xl font-bold">{usage.job_count}件</p><p className="mt-1 text-xs text-stone-600">処理中 {usage.active_job_count}件</p></div>
            </div>
            <div className="mt-4 grid gap-2" aria-label="利用率">
              {meters.map(([label, current, limit]) => limit ? (
                <div key={label}>
                  <div className="flex justify-between text-xs"><span>{label}</span><span>{usagePercent(current, limit)}%</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-violet-600" style={{ width: `${usagePercent(current, limit)}%` }} /></div>
                </div>
              ) : null)}
            </div>
            <details className="mt-5 rounded-xl border border-stone-200 p-4">
              <summary className="cursor-pointer font-bold">作品別の上限を設定</summary>
              <p className="mt-2 text-sm text-stone-600">空欄はアカウント全体の上限だけを使用します。上限到達時は新しい生成をDB側で停止します。</p>
              <form action={saveCloudProjectBudgetAction.bind(null, projectId)} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">月間生成credit<input className="field mt-1" defaultValue={usage.monthly_credit_limit ?? ""} min="1" name="monthlyCreditLimit" type="number" /></label>
                <label className="text-sm font-bold">月間費用上限（USD）<input className="field mt-1" defaultValue={usage.monthly_cost_limit_micros ? usd(usage.monthly_cost_limit_micros) : ""} min="0.01" name="monthlyCostUsd" step="0.01" type="number" /></label>
                <label className="text-sm font-bold">保存容量上限（MB）<input className="field mt-1" defaultValue={usage.storage_limit_bytes ? mb(usage.storage_limit_bytes) : ""} min="1" name="storageMb" step="0.1" type="number" /></label>
                <label className="text-sm font-bold">警告ライン（%）<input className="field mt-1" defaultValue={usage.warning_percent} max="100" min="50" name="warningPercent" type="number" /></label>
                <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2"><input defaultChecked={usage.generation_enabled} name="generationEnabled" type="checkbox" />この作品のAI生成を許可する</label>
                <div className="sm:col-span-2"><PendingSubmitButton className="button" pendingLabel="保存中…">生成上限を保存</PendingSubmitButton></div>
              </form>
            </details>
          </>;
        })()}
      </section>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="panel min-w-0" aria-labelledby="structure-heading">
          <h2 className="flex items-center gap-2 text-xl font-bold" id="structure-heading"><BookOpen className="h-5 w-5 text-violet-700" />章・シーン進捗</h2>
          {!data.longformAvailable ? <p className="mt-4 rounded-lg bg-amber-50 p-4 text-amber-900">長編構成migrationの適用後に章・シーン別表示を利用できます。</p> : null}
          {cockpit.chapters.length || cockpit.unassignedPages.length ? <CockpitStructure chapters={cockpit.chapters} plansAvailable={data.chapterPlansAvailable} projectId={projectId} unassignedPages={cockpit.unassignedPages} /> : <p className="mt-4 rounded-lg border border-dashed border-stone-300 p-5 text-stone-600">章を追加すると、ここに長編構成が表示されます。</p>}
        </section>

        <aside className="min-w-0 space-y-6">
          <section className="panel min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold"><AlertTriangle className="h-5 w-5 text-amber-700" />要確認</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-amber-50 p-3"><dt>一貫性警告</dt><dd className="text-2xl font-bold">{cockpit.issues.length}</dd></div><div className="rounded-lg bg-violet-50 p-3"><dt>未回収の伏線</dt><dd className="text-2xl font-bold">{cockpit.openThreads.length}</dd></div></dl>
            {cockpit.issues.slice(0, 5).map((issue) => <p className="mt-2 break-words rounded-lg bg-amber-50 p-3 text-sm text-amber-950" key={`${issue.code}-${issue.threadId ?? issue.factIds.join("-")}`}>{issue.message}</p>)}
            {!cockpit.issues.length ? <p className="mt-3 flex items-center gap-2 text-sm text-green-800"><CheckCircle2 className="h-4 w-4" />現在、警告はありません。</p> : null}
          </section>
          <section className="panel min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5 text-violet-700" />登場人物</h2>
            <p className="mt-3 break-words text-sm text-stone-700">{cockpit.characterNames.join("、") || "人物設定はまだありません。"}</p>
            <Link className="button-secondary mt-4 inline-flex" href={`/creator/${projectId}/characters`}>人物設定を確認</Link>
          </section>
          <section className="panel min-w-0"><h2 className="flex items-center gap-2 text-lg font-bold"><Database className="h-5 w-5 text-violet-700" />運用の目安</h2><p className="mt-3 text-sm leading-relaxed text-stone-600">4〜8ページずつ生成し、確認・修正してから次へ進むと、費用と容量を管理しやすくなります。</p></section>
          <section className="panel min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold"><GitBranch className="h-5 w-5 text-violet-700" />関係・時系列</h2>
            {cockpit.timeline.length ? <ol className="mt-3 space-y-2">{cockpit.timeline.slice(0, 12).map((item) => <li className="break-words border-l-2 border-violet-300 pl-3 text-sm" key={item.id}><strong>{item.startPage}{item.endPage !== item.startPage ? `〜${item.endPage}` : ""}P {item.subject}</strong><span className="mt-1 block text-stone-600">{item.label}</span></li>)}</ol> : <p className="mt-3 text-sm text-stone-600">登録済みの人物関係・時系列はありません。</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}
