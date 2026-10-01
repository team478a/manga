import type { CloudPageCompletion } from "@/modules/cloud-creator/projects/page-completion-service";
import type { CloudPageProductionState } from "@/lib/cloud-creator-server";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { finalizeCloudPageAndContinueAction, markCloudPageRevisionAddressedAction, reopenCloudPageFromEditorAction } from "@/app/creator/actions";

export function PageCompletionBanner({
  actionError,
  actionMessage,
  completion,
  productionState,
  projectId,
  pageId,
  saved,
}: {
  actionError: string | null;
  actionMessage: string | null;
  completion: CloudPageCompletion;
  productionState: CloudPageProductionState | null;
  projectId: string;
  pageId: string;
  saved: boolean;
}) {
  const pageRevisionRequired = completion.blockers.some(
    (blocker) => blocker.manualReviewSource === "page_revision",
  );
  const isStale = productionState?.isStale ?? false;
  const isFinalized = productionState?.status === "finalized" && !isStale;
  const canFinalize = Boolean(
    productionState && completion.complete && !isFinalized && !isStale && saved,
  );
  const tone = isStale
    ? "border-amber-200 bg-amber-50 text-amber-950"
    : completion.complete
    ? "border-green-200 bg-green-50 text-green-950"
    : completion.status === "generating"
      ? "border-blue-200 bg-blue-50 text-blue-950"
      : "border-amber-200 bg-amber-50 text-amber-950";
  const label = isStale
    ? "設定変更後の再確認が必要"
    : isFinalized
      ? "ページ確定済み"
      : completion.complete
        ? "完成条件を満たしています"
    : completion.status === "generating"
      ? "画像生成中"
      : completion.status === "review_required"
        ? "手動確認待ち"
        : "ページ未完成";
  return (
    <section className={`mx-auto max-w-[1600px] border p-4 text-sm ${tone}`} aria-labelledby="page-completion-status" role={completion.complete && !isStale ? "status" : "alert"}>
      <div className="flex flex-wrap items-center justify-between gap-2"><strong id="page-completion-status">{label}</strong><span>画像 {completion.panelImageCount}/{completion.requiredPanelImageCount}コマ・セリフ {completion.placedDialogueCount}/{completion.dialogueCount}件・生成中 {completion.pendingGenerationCount}件・失敗 {completion.failedGenerationCount}件</span></div>
      <p className="mt-1">保存revision {completion.savedRevision ?? "未保存"} / 最新 {completion.currentRevision ?? "不明"}・PNG {completion.blockers.some((item) => item.code === "PNG_RENDER_FAILED") ? "失敗" : "成功"}</p>
      {productionState ? <p className="mt-1">制作状態: {isStale ? "設定変更後の再確認" : productionState.status === "not_started" ? "未着手" : productionState.status === "generating" ? "生成中" : productionState.status === "review_required" ? "確認待ち" : productionState.status === "revision_required" ? "要修正" : "確定済み"}</p> : <p className="mt-1">制作状態を確認できないため、この画面からは更新できません。</p>}
      {actionError ? <p className="mt-2 rounded-md bg-red-100 p-2 text-red-900" role="alert">{actionError}</p> : actionMessage ? <p className="mt-2 rounded-md bg-blue-100 p-2 text-blue-900" role="status">{actionMessage}</p> : null}
      {completion.blockers.length ? <ul className="mt-2 list-disc pl-5">{completion.blockers.slice(0, 6).map((blocker, index) => <li key={`${blocker.code}-${blocker.panelId ?? index}`}>{blocker.message}</li>)}</ul> : null}
      {isStale ? <form action={reopenCloudPageFromEditorAction.bind(null, projectId, pageId)} className="mt-3"><PendingSubmitButton className="button-secondary min-h-10 px-4 py-2" pendingLabel="再開中…">編集を再開して再確認</PendingSubmitButton></form> : null}
      {completion.complete && productionState && !isFinalized && !isStale ? <form action={finalizeCloudPageAndContinueAction.bind(null, projectId, pageId)} className="mt-3"><PendingSubmitButton className="button min-h-10 px-4 py-2" disabled={!canFinalize} pendingLabel="確定中…">このページを確定して次へ</PendingSubmitButton>{!saved ? <p className="mt-2">保存が完了すると確定できます。</p> : null}</form> : null}
      {pageRevisionRequired ? (
        <form
          action={markCloudPageRevisionAddressedAction.bind(null, projectId, pageId)}
          className="mt-3"
        >
          <PendingSubmitButton
            className="button-secondary min-h-10 px-4 py-2"
            pendingLabel="更新中…"
          >
            修正完了として再確認
          </PendingSubmitButton>
        </form>
      ) : null}
    </section>
  );
}
