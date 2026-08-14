import type { CloudPageCompletion } from "@/modules/cloud-creator/projects/page-completion-service";

export function PageCompletionBanner({ completion }: { completion: CloudPageCompletion }) {
  const tone = completion.complete
    ? "border-green-200 bg-green-50 text-green-950"
    : completion.status === "generating"
      ? "border-blue-200 bg-blue-50 text-blue-950"
      : "border-amber-200 bg-amber-50 text-amber-950";
  const label = completion.complete
    ? "ページ完成"
    : completion.status === "generating"
      ? "画像生成中"
      : completion.status === "review_required"
        ? "手動確認待ち"
        : "ページ未完成";
  return (
    <section className={`mx-auto max-w-[1600px] border p-4 text-sm ${tone}`} aria-labelledby="page-completion-status" role={completion.complete ? "status" : "alert"}>
      <div className="flex flex-wrap items-center justify-between gap-2"><strong id="page-completion-status">{label}</strong><span>画像 {completion.panelImageCount}/{completion.requiredPanelImageCount}コマ・セリフ {completion.placedDialogueCount}/{completion.dialogueCount}件・生成中 {completion.pendingGenerationCount}件・失敗 {completion.failedGenerationCount}件</span></div>
      <p className="mt-1">保存revision {completion.savedRevision ?? "未保存"} / 最新 {completion.currentRevision ?? "不明"}・PNG {completion.blockers.some((item) => item.code === "PNG_RENDER_FAILED") ? "失敗" : "成功"}</p>
      {completion.blockers.length ? <ul className="mt-2 list-disc pl-5">{completion.blockers.slice(0, 6).map((blocker, index) => <li key={`${blocker.code}-${blocker.panelId ?? index}`}>{blocker.message}</li>)}</ul> : null}
    </section>
  );
}
