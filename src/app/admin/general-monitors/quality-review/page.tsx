import Link from "next/link";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireAdmin } from "@/lib/auth";
import { monitorQualityReviewEnabled } from "@/lib/monitor-quality-review";
import { loadMonitorQualityReviewAdminWorkspace } from "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";
import { assignMonitorQualityReviewAction } from "./actions";

export default async function MonitorQualityReviewAdminPage({ searchParams }: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  await requireAdmin();
  const notice = await searchParams;
  return (
    <main className="page">
      <p className="font-semibold text-violet-700">一般向けモニター</p>
      <h1 className="mt-1 text-3xl font-bold">漫画画像・品質確認の進捗</h1>
      {!monitorQualityReviewEnabled() ? (
        <p className="mt-6 rounded-lg bg-stone-100 p-4 text-stone-700">Feature Flagが停止中です。migration、権利確認済み画像、A/B割当の準備後に有効化してください。</p>
      ) : <QualityReviewAdminContent error={notice.error} message={notice.message} />}
      <Link className="button-secondary mt-6" href="/admin/general-monitors">モニター管理へ戻る</Link>
    </main>
  );
}

async function QualityReviewAdminContent({ error, message }: { error?: string; message?: string }) {
  let data = null;
  try {
    data = await loadMonitorQualityReviewAdminWorkspace();
  } catch {
    data = null;
  }
  if (!data) return <p className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-950">品質確認用migrationまたはデータを確認してください。</p>;
  const names = new Map(data.profiles.map((item) => [item.id, item.display_name]));
  const casesPerBatch = new Map<string, number>();
  for (const item of data.cases) casesPerBatch.set(item.batch_id, (casesPerBatch.get(item.batch_id) ?? 0) + 1);
  const completedPerAssignment = new Map<string, number>();
  for (const item of data.responses) if (item.case_completed_at)
    completedPerAssignment.set(item.assignment_id, (completedPerAssignment.get(item.assignment_id) ?? 0) + 1);
  const activeMonitors = data.enrollments;
  const activeBatches = data.batches.filter((item) => item.status === "active");
  return <>
      {error ? <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-900" role="alert">{error}</p> : null}
      {message ? <p className="mt-6 rounded-lg bg-green-50 p-4 text-green-900" role="status">{message}</p> : null}
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">確認担当を割り当てる</h2>
        <p className="mt-2 text-sm text-stone-600">同じBatchのAとBには異なるモニターを割り当てます。回答や正解ラベルは担当者へ表示されません。</p>
        <form action={assignMonitorQualityReviewAction} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_12rem_auto]">
          <select className="field" name="batchId" required><option value="">Batchを選択</option>{activeBatches.map((item) => <option key={item.id} value={item.id}>{item.batch_code}（{casesPerBatch.get(item.id) ?? 0}枚）</option>)}</select>
          <select className="field" name="reviewerProfileId" required><option value="">モニターを選択</option>{activeMonitors.map((item) => <option key={item.profile_id} value={item.profile_id}>{names.get(item.profile_id) || "表示名未設定"}</option>)}</select>
          <select className="field" name="reviewerSlot" required><option value="reviewer_a">Reviewer A</option><option value="reviewer_b">Reviewer B</option></select>
          <PendingSubmitButton className="button bg-violet-700 hover:bg-violet-800" pendingLabel="割当中…">割り当て</PendingSubmitButton>
        </form>
        {!activeBatches.length ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">権利確認済みの有効なBatchがまだ登録されていません。</p> : null}
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {data.batches.map((batch) => {
          const assignments = data.assignments.filter((item) => item.batch_id === batch.id);
          const total = casesPerBatch.get(batch.id) ?? 0;
          return <article className="panel" key={batch.id}>
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{batch.batch_code}</h2><p className="mt-1 text-sm text-stone-500">画像 {total}枚</p></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-900">{batch.status}</span></div>
            <div className="mt-4 space-y-3">
              {assignments.map((assignment) => <div className="rounded-xl border border-stone-200 p-3" key={assignment.id}>
                <div className="flex justify-between gap-3"><strong>{assignment.reviewer_slot === "reviewer_a" ? "Reviewer A" : "Reviewer B"}</strong><span className="text-sm">{assignment.status}</span></div>
                <p className="mt-1 text-sm text-stone-700">{names.get(assignment.reviewer_profile_id) || "表示名未設定"}</p>
                <p className="mt-2 text-sm font-bold">確定済み {completedPerAssignment.get(assignment.id) ?? 0} / {total}</p>
                <p className="mt-1 text-xs text-stone-500">開始確認: {assignment.consented_at ? "済み" : "未確認"}・最終送信: {assignment.submitted_at ? "済み" : "未送信"}</p>
                {assignment.submitted_at ? <a className="button-secondary mt-3 w-full" href={`/admin/general-monitors/quality-review/export?assignmentId=${assignment.id}`}>回答JSONを保存</a> : null}
              </div>)}
              {!assignments.length ? <p className="text-sm text-stone-600">担当者はまだ割り当てられていません。</p> : null}
            </div>
          </article>;
        })}
        {!data.batches.length ? <p className="panel text-stone-600">登録済みBatchはありません。</p> : null}
      </section>
  </>;
}
