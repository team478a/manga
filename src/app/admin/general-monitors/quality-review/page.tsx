import Link from "next/link";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireAdmin } from "@/lib/auth";
import { monitorQualityReviewEnabled } from "@/lib/monitor-quality-review";
import {
  describeMonitorQualityReviewSlot,
  MONITOR_QUALITY_REVIEW_DEFAULT_REVIEWER_COUNT,
  MONITOR_QUALITY_REVIEW_PILOT_CASE_COUNT,
  monitorQualityReviewSlotsForTarget,
} from "@/modules/manga-quality/domain/monitor-quality-review";
import { loadMonitorQualityReviewAdminWorkspace } from "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";
import {
  assignMonitorQualityReviewAction,
  setMonitorQualityReviewBatchLifecycleAction,
} from "./actions";

export default async function MonitorQualityReviewAdminPage({ searchParams }: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  await requireAdmin();
  const notice = await searchParams;
  const featureFlagEnabled = monitorQualityReviewEnabled();
  return (
    <main className="page">
      <p className="font-semibold text-violet-700">一般向けモニター</p>
      <h1 className="mt-1 text-3xl font-bold">漫画画像・品質確認の進捗</h1>
      {!featureFlagEnabled ? (
        <p className="mt-6 rounded-lg bg-stone-100 p-4 text-stone-700">Feature Flagは停止中です。Batchの検査と有効化はできますが、モニターへの割当・利用者画面公開はまだ行われません。</p>
      ) : null}
      <QualityReviewAdminContent error={notice.error} featureFlagEnabled={featureFlagEnabled} message={notice.message} />
      <Link className="button-secondary mt-6" href="/admin/general-monitors">モニター管理へ戻る</Link>
    </main>
  );
}

async function QualityReviewAdminContent({ error, featureFlagEnabled, message }: {
  error?: string;
  featureFlagEnabled: boolean;
  message?: string;
}) {
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
  return <>
      {error ? <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-900" role="alert">{error}</p> : null}
      {message ? <p className="mt-6 rounded-lg bg-green-50 p-4 text-green-900" role="status">{message}</p> : null}
      <section className="panel mt-6">
        <h2 className="text-xl font-bold">複数モニターによる独立確認</h2>
        <p className="mt-2 text-sm text-stone-600">既定は5名です。Primary Reviewer AとPrimary Reviewer Bは正式Benchmark比較用、Panel Reviewer C以降は補助票として分離します。各枠には異なるモニターを割り当て、他者の回答や正解ラベルは表示しません。</p>
        {!featureFlagEnabled ? <p className="mt-4 rounded-lg bg-stone-100 p-3 text-sm text-stone-700">Feature Flagを有効化するまで担当割当はできません。</p> : null}
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {data.batches.map((batch) => {
          const assignments = data.assignments.filter((item) => item.batch_id === batch.id);
          const total = casesPerBatch.get(batch.id) ?? 0;
          const targetReviewerCount = batch.target_reviewer_count ?? MONITOR_QUALITY_REVIEW_DEFAULT_REVIEWER_COUNT;
          const targetSlots = monitorQualityReviewSlotsForTarget(targetReviewerCount);
          const assignedSlots = new Set(assignments.map((item) => item.reviewer_slot));
          const assignedProfiles = new Set(assignments.map((item) => item.reviewer_profile_id));
          const availableSlots = targetSlots.filter((slot) => !assignedSlots.has(slot));
          const availableMonitors = activeMonitors.filter((item) => !assignedProfiles.has(item.profile_id));
          const canActivate = batch.status === "draft" && total === MONITOR_QUALITY_REVIEW_PILOT_CASE_COUNT && assignments.length === 0;
          const startsAt = Date.parse(batch.starts_at);
          const expiresAt = Date.parse(batch.expires_at);
          const now = Date.parse(data.loadedAt);
          const assignmentPeriodOpen = startsAt <= now && expiresAt > now;
          const startsAtJapan = new Date(batch.starts_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
          return <article className="panel" key={batch.id}>
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{batch.batch_code}</h2><p className="mt-1 text-sm text-stone-500">画像 {total}枚</p></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-900">{batch.status}</span></div>
            <p className="mt-2 text-xs text-stone-500">期間: {batch.starts_at} 〜 {batch.expires_at}</p>
            <p className="mt-2 text-sm font-bold">確認者 {assignments.length} / {targetReviewerCount}名</p>
            {batch.status === "draft" ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-950">権利確認、元package SHA-256、期間、画像{MONITOR_QUALITY_REVIEW_PILOT_CASE_COUNT}枚、既存割当0件をサーバーで再検査してから有効化します。有効化だけではモニターへ公開されません。</p>
              <form action={setMonitorQualityReviewBatchLifecycleAction} className="mt-3">
                <input name="batchId" type="hidden" value={batch.id} />
                <input name="transition" type="hidden" value="activate" />
                <PendingSubmitButton className="button bg-violet-700 hover:bg-violet-800" disabled={!canActivate} pendingLabel="検査・有効化中…">Batchを検査して有効化</PendingSubmitButton>
              </form>
              {!canActivate ? <p className="mt-2 text-xs text-red-800">画像28枚・既存割当0件の条件を確認してください。</p> : null}
            </div> : null}
            {batch.status === "active" ? <form action={setMonitorQualityReviewBatchLifecycleAction} className="mt-4">
              <input name="batchId" type="hidden" value={batch.id} />
              <input name="transition" type="hidden" value="pause" />
              <PendingSubmitButton className="button-secondary" pendingLabel="停止中…">Batchを停止</PendingSubmitButton>
            </form> : null}
            {batch.status === "paused" ? <form action={setMonitorQualityReviewBatchLifecycleAction} className="mt-4">
              <input name="batchId" type="hidden" value={batch.id} />
              <input name="transition" type="hidden" value="resume" />
              <PendingSubmitButton className="button-secondary" pendingLabel="再検査・再開中…">Batchを検査して再開</PendingSubmitButton>
            </form> : null}
            {batch.status === "active" ? <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
              <h3 className="font-bold">このBatchへ確認担当を追加</h3>
              {!assignmentPeriodOpen ? <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">割り当ては開始日時の{startsAtJapan}（日本時間）以降に行えます。</p> : null}
              {assignmentPeriodOpen && availableSlots.length > 0 && availableMonitors.length > 0 ? <form action={assignMonitorQualityReviewAction} className="mt-3 grid gap-3">
                <input name="batchId" type="hidden" value={batch.id} />
                <select className="field" disabled={!featureFlagEnabled} name="reviewerProfileId" required>
                  <option value="">モニターを選択</option>
                  {availableMonitors.map((item) => <option key={item.profile_id} value={item.profile_id}>{names.get(item.profile_id) || "表示名未設定"}</option>)}
                </select>
                <select className="field" disabled={!featureFlagEnabled} name="reviewerSlot" required>
                  {availableSlots.map((slot) => <option key={slot} value={slot}>{describeMonitorQualityReviewSlot(slot)}</option>)}
                </select>
                <PendingSubmitButton className="button bg-violet-700 hover:bg-violet-800" disabled={!featureFlagEnabled} pendingLabel="割当中…">割り当て</PendingSubmitButton>
              </form> : assignmentPeriodOpen ? <p className="mt-2 text-sm text-stone-700">目標枠が埋まったか、割当可能な別モニターがいません。</p> : null}
            </div> : null}
            <div className="mt-4 space-y-3">
              {assignments.map((assignment) => <div className="rounded-xl border border-stone-200 p-3" key={assignment.id}>
                <div className="flex justify-between gap-3"><strong>{describeMonitorQualityReviewSlot(assignment.reviewer_slot)}</strong><span className="text-sm">{assignment.status}</span></div>
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
