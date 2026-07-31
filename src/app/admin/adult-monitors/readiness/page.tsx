import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, Rocket } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getCloudAdultMonitorReadiness } from "@/lib/cloud-adult-monitor-readiness";

export default async function AdultMonitorReadinessPage() {
  await requireAdmin();
  const readiness = await getCloudAdultMonitorReadiness();
  return (
    <main className="page max-w-5xl">
      <Link className="text-violet-700 underline" href="/admin/adult-monitors">← 成人向けモニター管理</Link>
      <header className="mt-5">
        <p className="text-sm font-bold text-violet-700">秘密値を表示しない事前確認</p>
        <h1 className="mt-1 text-3xl font-bold">成人向けモニター公開チェック</h1>
        <p className="mt-2 text-stone-600">18歳以上の許可ユーザーを招待する前に、停止境界を含む実行条件を確認します。</p>
      </header>
      <section className={`mt-7 rounded-2xl border p-5 ${readiness.ready ? "border-green-200 bg-green-50 text-green-950" : "border-amber-200 bg-amber-50 text-amber-950"}`} role="status">
        <div className="flex gap-3">
          {readiness.ready ? <Rocket className="h-6 w-6 shrink-0" /> : <AlertTriangle className="h-6 w-6 shrink-0" />}
          <div><h2 className="text-xl font-bold">{readiness.ready ? "スタッフ1名から開始できます" : "招待前に確認が必要です"}</h2><p className="mt-1 text-sm">最初はスタッフ1名で全工程と停止操作を確認してください。</p></div>
        </div>
      </section>
      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {readiness.checks.map((check) => (
          <article className="panel min-w-0" key={check.key}>
            <div className="flex items-center gap-2">{check.ready ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <CircleDashed className="h-5 w-5 text-amber-600" />}<span className="text-sm font-bold text-stone-500">{check.ready ? "準備完了" : "要確認"}</span></div>
            <h2 className="mt-3 text-lg font-bold">{check.label}</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{check.detail}</p>
            {check.href ? <Link className="mt-4 inline-block text-sm font-bold text-violet-700 underline" href={check.href}>設定画面を開く</Link> : null}
          </article>
        ))}
      </section>
      <section className="panel mt-8">
        <h2 className="text-xl font-bold">現在の運用状況</h2>
        <p className="mt-3">利用中 {readiness.stats.active}名・未対応フィードバック {readiness.stats.openFeedback}件</p>
      </section>
    </main>
  );
}
