import { Download, FileCheck2, Pause, Play, RotateCcw, XCircle } from "lucide-react";
import type { CloudExportJob } from "@/modules/cloud-creator/export/durable-export-service";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { setCloudExportStateAction, startCloudExportAction } from "@/app/creator/actions";
import { DurableExportAutoRefresh } from "./DurableExportAutoRefresh";

export function DurableExportPanel({ projectId, available, ready, jobs, extendedFormatsEnabled = false }: {
  projectId: string;
  available: boolean;
  ready: boolean;
  jobs: CloudExportJob[];
  extendedFormatsEnabled?: boolean;
}) {
  const active = jobs.find((job) => ["queued", "running", "paused"].includes(job.status));
  return (
    <section className="panel mt-6" aria-labelledby="durable-export">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold" id="durable-export"><FileCheck2 className="h-6 w-6 text-violet-700" />完成原稿PDF</h2>
          <p className="mt-2 text-sm text-stone-600">4ページずつ安全に処理します。画面を閉じても書き出しは継続し、途中から再開できます。</p>
        </div>
        <form action={startCloudExportAction.bind(null, projectId, "pdf")}>
          <PendingSubmitButton className="button" disabled={!available || !ready || Boolean(active)} pendingLabel="書き出しを登録しています…">PDF書き出しを開始</PendingSubmitButton>
        </form>
      </div>
      {extendedFormatsEnabled ? <div className="mt-3 flex flex-wrap gap-2">
        <form action={startCloudExportAction.bind(null, projectId, "images")}><PendingSubmitButton className="button-secondary" disabled={!available || !ready || Boolean(active)} pendingLabel="登録中…">連番PNG ZIPを開始</PendingSubmitButton></form>
        <form action={startCloudExportAction.bind(null, projectId, "project_json")}><PendingSubmitButton className="button-secondary" disabled={!available || !ready || Boolean(active)} pendingLabel="登録中…">Project JSONを開始</PendingSubmitButton></form>
      </div> : null}
      {!available ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">長編書き出し用migrationの適用後に利用できます。</p> : !ready ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">原稿チェックを解消し、すべてのページを確定すると開始できます。</p> : null}
      <DurableExportAutoRefresh active={Boolean(active)} />
      {jobs.length ? <div className="mt-5 space-y-3">{jobs.map((job) => {
        const label = job.status === "completed" ? "完了" : job.status === "failed" ? "失敗" : job.status === "paused" ? "一時停止中" : job.status === "canceled" ? "中止" : job.status === "running" ? "処理中" : "待機中";
        return <article className="rounded-lg border border-stone-200 p-4" key={job.id}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><strong>{label}</strong><p className="mt-1 text-sm text-stone-600">{job.completedPages}/{job.totalPages}ページ・{job.progress}%</p></div><div className="flex flex-wrap gap-2">
            {job.downloadable ? <a className="button" href={`/api/creator/exports/${job.id}/download`}><Download className="mr-1 h-4 w-4" />{job.format === "pdf" ? "PDFをダウンロード" : job.format === "images" ? "PNG ZIPをダウンロード" : "Project JSONをダウンロード"}</a> : null}
            {job.status === "queued" || job.status === "running" ? <form action={setCloudExportStateAction.bind(null, projectId, job.id, "paused")}><PendingSubmitButton className="button-secondary" pendingLabel="停止中…"><Pause className="mr-1 h-4 w-4" />一時停止</PendingSubmitButton></form> : null}
            {job.status === "paused" ? <form action={setCloudExportStateAction.bind(null, projectId, job.id, "queued")}><PendingSubmitButton className="button-secondary" pendingLabel="再開中…"><Play className="mr-1 h-4 w-4" />再開</PendingSubmitButton></form> : null}
            {job.status === "failed" ? <form action={setCloudExportStateAction.bind(null, projectId, job.id, "queued")}><PendingSubmitButton className="button-secondary" pendingLabel="再登録中…"><RotateCcw className="mr-1 h-4 w-4" />失敗箇所から再開</PendingSubmitButton></form> : null}
            {["queued", "running", "paused", "failed"].includes(job.status) ? <form action={setCloudExportStateAction.bind(null, projectId, job.id, "canceled")}><PendingSubmitButton className="button-secondary text-red-700" pendingLabel="中止中…"><XCircle className="mr-1 h-4 w-4" />中止</PendingSubmitButton></form> : null}
          </div></div>
          {job.status === "failed" ? <p className="mt-3 text-sm text-red-700">内部処理に失敗しました。再開しても失敗する場合は運営へ連絡してください。</p> : null}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full bg-violet-600" style={{ width: `${job.progress}%` }} /></div>
        </article>;
      })}</div> : null}
    </section>
  );
}
