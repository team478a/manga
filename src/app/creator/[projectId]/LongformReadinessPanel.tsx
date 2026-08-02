import { AlertTriangle, CheckCircle2, CircleDashed, Flag } from "lucide-react";
import type { LongformReadiness } from "@/lib/cloud-longform-readiness";

export function LongformReadinessPanel({ readiness }: { readiness: LongformReadiness }) {
  return (
    <section className="panel mt-6 border-violet-200 bg-violet-50/40" aria-labelledby="longform-readiness-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-700">長編完成ガイド</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-bold" id="longform-readiness-heading">
            <Flag className="h-5 w-5 text-violet-700" />完成・復旧の準備
          </h2>
          <p className="mt-2 text-sm text-stone-600">原稿を安全に完成し、途中から復旧できる状態まで順番に確認します。</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-sm font-bold ${readiness.ready ? "bg-green-100 text-green-800" : "bg-white text-violet-800"}`}>
          {readiness.ready ? "完成準備完了" : `${readiness.completedCount}/${readiness.totalCount} 完了`}
        </span>
      </div>
      <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {readiness.items.map((item, index) => {
          const Icon = item.status === "complete" ? CheckCircle2 : item.status === "unavailable" ? AlertTriangle : CircleDashed;
          const style = item.status === "complete"
            ? "border-green-200 bg-green-50 text-green-900"
            : item.status === "unavailable"
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-violet-200 bg-white text-stone-900";
          return <li className={`rounded-xl border p-4 ${style}`} key={item.id}>
            <div className="flex items-center gap-2"><Icon className="h-5 w-5 shrink-0" /><strong>{index + 1}. {item.label}</strong></div>
            <p className="mt-2 text-xs leading-relaxed">{item.detail}</p>
          </li>;
        })}
      </ol>
      <a className="button mt-5 inline-flex" href={readiness.nextAction.href}>{readiness.nextAction.label}</a>
    </section>
  );
}
