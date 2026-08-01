import { Archive, CheckCircle2, LockKeyhole } from "lucide-react";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import type { CloudProjectCheckpoint } from "@/lib/cloud-creator-server";
import { createCloudProjectCheckpointAction } from "@/app/creator/actions";

export function ProjectCheckpointPanel({ available, checkpoints, projectId, releaseReady }: {
  available: boolean;
  checkpoints: CloudProjectCheckpoint[];
  projectId: string;
  releaseReady: boolean;
}) {
  return (
    <section className="panel mt-6" aria-labelledby="checkpoint-heading">
      <h2 className="flex items-center gap-2 text-xl font-bold" id="checkpoint-heading"><Archive className="h-5 w-5 text-violet-700" />バックアップと完成版</h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">保存済みページの変更分だけを再利用して固定します。完成版は原稿チェックと全ページ確定後に作成できます。</p>
      {!available ? <p className="mt-4 rounded-lg bg-amber-50 p-4 text-amber-900">作品バックアップ用migrationの適用後に利用できます。</p> : <>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form action={createCloudProjectCheckpointAction.bind(null, projectId, "checkpoint")} className="rounded-xl border border-violet-100 p-4">
            <h3 className="font-bold">作業バックアップ</h3>
            <p className="mt-1 text-xs text-stone-600">大きな修正や一括生成の前に作成します。</p>
            <label className="label mt-3" htmlFor="checkpoint-label">名前</label>
            <input className="field" defaultValue={`作業バックアップ ${new Date().toLocaleDateString("ja-JP")}`} id="checkpoint-label" maxLength={100} name="label" required />
            <PendingSubmitButton className="button-secondary mt-3" pendingLabel="作成中…">バックアップを作成</PendingSubmitButton>
          </form>
          <form action={createCloudProjectCheckpointAction.bind(null, projectId, "release")} className="rounded-xl border border-violet-100 p-4">
            <h3 className="flex items-center gap-2 font-bold"><LockKeyhole className="h-4 w-4" />完成版を固定</h3>
            <p className="mt-1 text-xs text-stone-600">完成原稿としてページ構成とCanvas revisionを固定します。</p>
            <label className="label mt-3" htmlFor="release-label">完成版名</label>
            <input className="field" defaultValue={`完成版 ${new Date().toLocaleDateString("ja-JP")}`} id="release-label" maxLength={100} name="label" required />
            <PendingSubmitButton className="button mt-3" disabled={!releaseReady} pendingLabel="固定中…">完成版を固定</PendingSubmitButton>
            {!releaseReady ? <p className="mt-2 text-xs text-amber-800">原稿チェックの要修正を解消し、全ページを確定してください。</p> : null}
          </form>
        </div>
        <div className="mt-5">
          <h3 className="font-bold">固定版履歴</h3>
          {checkpoints.length ? <ol className="mt-3 space-y-2">{checkpoints.map((item) => <li className="flex min-w-0 flex-col gap-2 rounded-lg bg-violet-50 p-3 sm:flex-row sm:items-center sm:justify-between" key={item.id}>
            <div className="min-w-0"><p className="break-words font-bold">{item.label}</p><p className="text-xs text-stone-600">{item.kind === "release" ? "完成版" : "作業バックアップ"}・{item.pageCount}ページ・{new Date(item.createdAt).toLocaleString("ja-JP")}</p></div>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${item.isCurrent ? "bg-green-100 text-green-800" : "bg-stone-200 text-stone-700"}`}>{item.isCurrent ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}{item.isCurrent ? "現在と一致" : "変更あり"}</span>
          </li>)}</ol> : <p className="mt-3 rounded-lg border border-dashed border-stone-300 p-4 text-sm text-stone-600">固定版はまだありません。</p>}
        </div>
      </>}
    </section>
  );
}
