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
import {
  deriveMonitorQualityReviewAdjudicationDecision,
  type MonitorQualityReviewAdjudicationStatus,
} from "@/modules/manga-quality/domain/monitor-quality-review-adjudication";
import {
  loadMonitorQualityReviewAdminWorkspace,
  loadMonitorQualityReviewBenchmarkSummary,
} from "@/modules/manga-quality/infrastructure/monitor-quality-review-repository";
import {
  assignMonitorQualityReviewAction,
  assignMonitorQualityReviewAdjudicationAction,
  revokeMonitorQualityReviewAdjudicationAction,
  sendMonitorQualityReviewStartNotificationsAction,
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
  const completedSummaries = new Map(await Promise.all(
    data.batches
      .filter((batch) => batch.status === "completed")
      .map(async (batch) => [batch.id, await loadMonitorQualityReviewBenchmarkSummary(batch.id)] as const),
  ));
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
          const summary = completedSummaries.get(batch.id);
          const assignments = data.assignments.filter((item) => item.batch_id === batch.id);
          const total = casesPerBatch.get(batch.id) ?? 0;
          const targetReviewerCount = batch.target_reviewer_count ?? MONITOR_QUALITY_REVIEW_DEFAULT_REVIEWER_COUNT;
          const targetSlots = monitorQualityReviewSlotsForTarget(targetReviewerCount);
          const assignedSlots = new Set(assignments.map((item) => item.reviewer_slot));
          const assignedProfiles = new Set(assignments.map((item) => item.reviewer_profile_id));
          const notifiedCount = assignments.filter((item) => item.notification_sent_at).length;
          const pendingNotificationCount = assignments.filter((item) =>
            !item.notification_sent_at && item.status !== "submitted" && !item.submitted_at
          ).length;
          const completedWithoutNotificationCount = assignments.filter((item) =>
            !item.notification_sent_at && (item.status === "submitted" || Boolean(item.submitted_at))
          ).length;
          const submittedAssignmentCount = assignments.filter((item) =>
            item.status === "submitted" && Boolean(item.submitted_at)
          ).length;
          const completedResponseCount = assignments.reduce(
            (sum, item) => sum + (completedPerAssignment.get(item.id) ?? 0),
            0,
          );
          const expectedResponseCount = total * targetReviewerCount;
          const availableSlots = targetSlots.filter((slot) => !assignedSlots.has(slot));
          const availableMonitors = activeMonitors.filter((item) => !assignedProfiles.has(item.profile_id));
          const canActivate = batch.status === "draft" && total === MONITOR_QUALITY_REVIEW_PILOT_CASE_COUNT && assignments.length === 0;
          const canComplete = batch.status === "active"
            && assignments.length === targetReviewerCount
            && assignedProfiles.size === targetReviewerCount
            && submittedAssignmentCount === targetReviewerCount
            && completedResponseCount === expectedResponseCount;
          const startsAt = Date.parse(batch.starts_at);
          const expiresAt = Date.parse(batch.expires_at);
          const now = Date.parse(data.loadedAt);
          const assignmentPeriodOpen = startsAt <= now && expiresAt > now;
          const startsAtJapan = new Date(batch.starts_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
          return <article className="panel" key={batch.id}>
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{batch.batch_code}</h2><p className="mt-1 text-sm text-stone-500">画像 {total}枚</p></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-900">{batch.status}</span></div>
            <p className="mt-2 text-xs text-stone-500">期間: {batch.starts_at} 〜 {batch.expires_at}</p>
            <p className="mt-2 text-sm font-bold">確認者 {assignments.length} / {targetReviewerCount}名</p>
            <p className="mt-1 text-sm text-stone-600">開始案内 {notifiedCount} / {assignments.length}名へ送信済み</p>
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
            {batch.status === "active" && assignments.length === targetReviewerCount ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <h3 className="font-bold">品質確認Batchの完了</h3>
              <p className="mt-1 text-sm text-stone-700">提出済み {submittedAssignmentCount} / {targetReviewerCount}名・確定回答 {completedResponseCount} / {expectedResponseCount}件</p>
              <p className="mt-2 text-sm text-stone-700">全員の最終送信と全28枚の確定回答をサーバーで再検査してから、Batchを完了状態にします。回答は削除されません。</p>
              <form action={setMonitorQualityReviewBatchLifecycleAction} className="mt-3">
                <input name="batchId" type="hidden" value={batch.id} />
                <input name="transition" type="hidden" value="complete" />
                <label className="flex items-start gap-2 text-sm"><input className="mt-1" name="confirmation" required type="checkbox" value="complete" />全確認担当の提出と確定回答件数を確認しました</label>
                <PendingSubmitButton className="button mt-3 bg-emerald-700 hover:bg-emerald-800" disabled={!canComplete} pendingLabel="完了処理中…">全回答を検査してBatchを完了</PendingSubmitButton>
              </form>
              {!canComplete ? <p className="mt-2 text-xs text-red-800">目標人数分の提出と、各担当28件の確定回答を確認してください。</p> : null}
            </div> : null}
            {batch.status === "completed" ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
              <p>このBatchは完了済みです。回答JSONは引き続き保存できます。</p>
              {summary ? <div className="mt-3 border-t border-emerald-200 pt-3">
                <h3 className="font-bold">匿名Benchmark集計</h3>
                <p className="mt-1">Primary A/B: 完全一致 {summary.primary.exactAgreementCount} / {summary.primary.caseCount}件（{Math.round(summary.primary.exactAgreementRate * 100)}%）・Cohen&apos;s κ {summary.primary.cohenKappa}</p>
                <p className="mt-1">補助Panel: {summary.panel.reviewerCount}名・{summary.panel.responseCount}件（正式判定には加算しません）</p>
                <p className="mt-1 font-bold">{summary.decision.status === "needs_adjudication"
                  ? `不一致${summary.decision.disagreementCaseKeys.length}件の第三者裁定が必要です`
                  : summary.decision.status === "pilot_review_passed"
                    ? "Pilot回答契約を通過しました"
                    : summary.decision.status === "agreement_below_threshold"
                      ? "合意率またはκが基準未満です"
                      : "回答の不足または契約不一致があります"}</p>
                <p className="mt-1 text-xs">28画像のPilot集計であり、正式Benchmarkの140画像要件は未達です。自動採用・画像削除は行いません。</p>
                <a className="button-secondary mt-3 w-full" href={`/admin/general-monitors/quality-review/summary?batchId=${batch.id}`}>匿名集計JSONを保存</a>
              </div> : <p className="mt-2 text-red-800">匿名集計を作成できませんでした。回答schemaを確認してください。</p>}
              {summary?.decision.status === "needs_adjudication" ? <AdjudicationAdminPanel
                activeMonitors={activeMonitors}
                assignments={assignments}
                batchId={batch.id}
                data={data}
                featureFlagEnabled={featureFlagEnabled}
                summary={summary}
              /> : null}
            </div> : null}
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
            {batch.status === "active" && assignments.length === targetReviewerCount ? <form action={sendMonitorQualityReviewStartNotificationsAction} className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <input name="batchId" type="hidden" value={batch.id} />
              <p className="font-bold">品質確認の開始案内</p>
              <p className="mt-1 text-sm text-stone-700">未提出かつ未送信の確認担当だけへ、品質確認URL・28枚・期限・途中保存方法をメールで案内します。提出済み担当者には送信しません。</p>
              {completedWithoutNotificationCount ? <p className="mt-2 text-xs text-stone-600">提出済みのため送信対象外: {completedWithoutNotificationCount}名</p> : null}
              <label className="mt-3 flex items-start gap-2 text-sm"><input className="mt-1" name="confirmation" required type="checkbox" value="send" />登録済みメールアドレスへの外部送信を確認しました</label>
              <PendingSubmitButton className="button mt-3 bg-emerald-700 hover:bg-emerald-800" disabled={pendingNotificationCount === 0} pendingLabel="開始案内を送信中…">{pendingNotificationCount === 0 ? "開始案内が必要な担当者はいません" : `未提出・未送信${pendingNotificationCount}名へ開始案内を送信`}</PendingSubmitButton>
            </form> : null}
            <div className="mt-4 space-y-3">
              {assignments.map((assignment) => <div className="rounded-xl border border-stone-200 p-3" key={assignment.id}>
                <div className="flex justify-between gap-3"><strong>{describeMonitorQualityReviewSlot(assignment.reviewer_slot)}</strong><span className="text-sm">{assignment.status}</span></div>
                <p className="mt-1 text-sm text-stone-700">{names.get(assignment.reviewer_profile_id) || "表示名未設定"}</p>
                <p className="mt-2 text-sm font-bold">確定済み {completedPerAssignment.get(assignment.id) ?? 0} / {total}</p>
                <p className="mt-1 text-xs text-stone-500">開始確認: {assignment.consented_at ? "済み" : "未確認"}・最終送信: {assignment.submitted_at ? "済み" : "未送信"}</p>
                <p className="mt-1 text-xs text-stone-500">開始案内: {assignment.notification_sent_at ? `${new Date(assignment.notification_sent_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}送信` : "未送信"}</p>
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

type AdminWorkspace = Awaited<ReturnType<typeof loadMonitorQualityReviewAdminWorkspace>>;
type BenchmarkSummary = NonNullable<Awaited<ReturnType<typeof loadMonitorQualityReviewBenchmarkSummary>>>;

const adjudicationStatusLabels: Record<MonitorQualityReviewAdjudicationStatus, string> = {
  assigned: "割当済み",
  in_progress: "確認中",
  independent_locked: "独立判断確定",
  submitted: "最終裁定確定",
  abstained: "判断不能",
  revoked: "停止済み",
};

const adjudicationDecisionLabels = {
  not_required: "裁定不要",
  needs_adjudication: "裁定が必要",
  adjudication_blocked: "要確認",
  pilot_adjudication_complete: "Pilot裁定完了",
} as const;

function AdjudicationAdminPanel({
  activeMonitors,
  assignments,
  batchId,
  data,
  featureFlagEnabled,
  summary,
}: {
  activeMonitors: AdminWorkspace["enrollments"];
  assignments: AdminWorkspace["assignments"];
  batchId: string;
  data: AdminWorkspace;
  featureFlagEnabled: boolean;
  summary: BenchmarkSummary;
}) {
  const batchCases = data.cases.filter((item) => item.batch_id === batchId);
  const caseById = new Map(batchCases.map((item) => [item.id, item]));
  const caseByKey = new Map(batchCases.map((item) => [item.case_key, item]));
  const requiredCases = summary.decision.disagreementCaseKeys
    .map((caseKey) => caseByKey.get(caseKey))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const adjudications = data.adjudications.filter((item) => item.batch_id === batchId);
  const activeByCase = new Map(adjudications
    .filter((item) => item.status !== "revoked")
    .map((item) => [item.case_id, item]));
  const unassignedCases = requiredCases.filter((item) => !activeByCase.has(item.id));
  const primaryProfileIds = new Set(assignments
    .filter((item) => item.reviewer_slot === "reviewer_a" || item.reviewer_slot === "reviewer_b")
    .map((item) => item.reviewer_profile_id));
  const eligibleMonitors = activeMonitors.filter((item) => !primaryProfileIds.has(item.profile_id));
  const assignmentByProfile = new Map(assignments.map((item) => [item.reviewer_profile_id, item]));
  const adjudicatorLabel = (profileId: string, fallbackIndex = 0) => {
    const existing = assignmentByProfile.get(profileId);
    return existing
      ? describeMonitorQualityReviewSlot(existing.reviewer_slot)
      : `適格な第三者確認担当 ${fallbackIndex + 1}`;
  };
  const decision = deriveMonitorQualityReviewAdjudicationDecision({
    disagreementCaseKeys: summary.decision.disagreementCaseKeys,
    adjudications: adjudications.flatMap((item) => {
      const reviewCase = caseById.get(item.case_id);
      return reviewCase ? [{ caseKey: reviewCase.case_key, status: item.status }] : [];
    }),
  });
  const statusCounts = Object.fromEntries(
    Object.keys(adjudicationStatusLabels).map((status) => [
      status,
      adjudications.filter((item) => item.status === status).length,
    ]),
  ) as Record<MonitorQualityReviewAdjudicationStatus, number>;
  const canAssign = featureFlagEnabled
    && data.adjudicationConfigured
    && unassignedCases.length > 0
    && eligibleMonitors.length > 0;

  return <section className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
    <h3 className="font-bold">第三者裁定（派生状態: {adjudicationDecisionLabels[decision.status]}）</h3>
    <p className="mt-1 text-sm font-bold">不一致{decision.requiredCount}件中 {decision.submittedCount}件確定</p>
    <p className="mt-1 text-xs text-stone-700">
      割当済み {statusCounts.assigned}・確認中 {statusCounts.in_progress}・独立判断確定 {statusCounts.independent_locked}・最終裁定 {statusCounts.submitted}・判断不能 {statusCounts.abstained}・停止履歴 {statusCounts.revoked}
    </p>
    <p className="mt-2 text-xs text-stone-600">完全一致5件は対象外です。裁定後も元のA/B回答、一致率、κは変更せず、自動採用・画像削除を行いません。</p>
    {!data.adjudicationConfigured ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">裁定用migrationは未適用です。画面確認はできますが、割当・停止操作はできません。</p> : null}
    {data.adjudicationConfigured ? <a className="button-secondary mt-3 w-full" href={`/admin/general-monitors/quality-review/adjudication-export?batchId=${batchId}`}>匿名裁定JSONを保存</a> : null}

    <div className="mt-4 rounded-lg border border-violet-200 bg-white p-3">
      <h4 className="font-bold">不一致ケース1件へ担当を割り当てる</h4>
      <p className="mt-1 text-xs text-stone-600">この操作だけではメール、外部案内、回答依頼を送信しません。担当者名や個人別成績も進捗一覧へ表示しません。</p>
      <form action={assignMonitorQualityReviewAdjudicationAction} className="mt-3 grid gap-3">
        <input name="batchId" type="hidden" value={batchId} />
        <label className="text-xs font-bold" htmlFor={`adjudication-case-${batchId}`}>裁定対象</label>
        <select className="field" disabled={!canAssign} id={`adjudication-case-${batchId}`} name="caseId" required>
          <option value="">未割当の不一致ケースを選択</option>
          {unassignedCases.map((item) => <option key={item.id} value={item.id}>{item.case_key}</option>)}
        </select>
        <label className="text-xs font-bold" htmlFor={`adjudicator-${batchId}`}>裁定担当</label>
        <select className="field" disabled={!canAssign} id={`adjudicator-${batchId}`} name="adjudicatorProfileId" required>
          <option value="">Primary A/B以外の担当を選択</option>
          {eligibleMonitors.map((item, index) => <option key={item.profile_id} value={item.profile_id}>{adjudicatorLabel(item.profile_id, index)}</option>)}
        </select>
        <label className="flex items-start gap-2 text-xs"><input className="mt-1" name="scopeConfirmation" required type="checkbox" value="one_disagreement_case" />選択した不一致ケース1件だけが対象です</label>
        <label className="flex items-start gap-2 text-xs"><input className="mt-1" name="independenceConfirmation" required type="checkbox" value="not_primary_reviewer" />担当者がこのBatchのPrimary Reviewer A/B本人ではないことを確認しました</label>
        <label className="flex items-start gap-2 text-xs"><input className="mt-1" name="deliveryConfirmation" required type="checkbox" value="no_external_delivery" />この操作では外部送信・通知を行わないことを確認しました</label>
        <PendingSubmitButton className="button bg-violet-700 hover:bg-violet-800" disabled={!canAssign} pendingLabel="割当中…">裁定担当を割り当てる</PendingSubmitButton>
      </form>
      {data.adjudicationConfigured && !unassignedCases.length ? <p className="mt-2 text-xs text-stone-600">すべての不一致ケースに有効な担当があります。</p> : null}
      {data.adjudicationConfigured && !eligibleMonitors.length ? <p className="mt-2 text-xs text-red-800">Primary A/B以外の有効なモニター登録がありません。</p> : null}
    </div>

    <div className="mt-4 space-y-3">
      {adjudications.map((item, index) => {
        const reviewCase = caseById.get(item.case_id);
        return <div className="rounded-lg border border-violet-200 bg-white p-3" key={item.id}>
          <div className="flex items-start justify-between gap-3">
            <div><strong>{reviewCase?.case_key ?? "対象ケース不明"}</strong><p className="mt-1 text-xs text-stone-600">{adjudicatorLabel(item.adjudicator_profile_id, index)}</p></div>
            <span className="text-xs font-bold">{adjudicationStatusLabels[item.status]}</span>
          </div>
          <p className="mt-2 text-xs text-stone-500">独立判断: {item.independent_locked_at ? "確定済み" : "未確定"}・A/B差分: {item.differences_revealed_at ? "開示済み" : "未開示"}・最終裁定: {item.submitted_at ? "確定済み" : "未確定"}</p>
          {item.status !== "revoked" ? <form action={revokeMonitorQualityReviewAdjudicationAction} className="mt-3 grid gap-2 border-t border-stone-200 pt-3">
            <input name="adjudicationId" type="hidden" value={item.id} />
            <label className="text-xs font-bold" htmlFor={`revoke-reason-${item.id}`}>停止理由</label>
            <textarea className="field min-h-20" id={`revoke-reason-${item.id}`} maxLength={500} name="reason" required />
            <label className="flex items-start gap-2 text-xs"><input className="mt-1" name="confirmation" required type="checkbox" value="revoke_with_history" />回答と監査履歴を削除せず保持して停止します</label>
            <PendingSubmitButton className="button-secondary" disabled={!data.adjudicationConfigured} pendingLabel="停止中…">裁定を停止（記録保持）</PendingSubmitButton>
          </form> : <p className="mt-2 text-xs text-stone-600">停止済みの履歴です。削除されていません。</p>}
        </div>;
      })}
      {!adjudications.length ? <p className="text-sm text-stone-600">裁定担当はまだ割り当てられていません。</p> : null}
    </div>
  </section>;
}
