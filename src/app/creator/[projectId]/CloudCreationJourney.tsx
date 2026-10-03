import { CheckCircle2, CircleDashed, Compass } from "lucide-react";

type CloudCreationJourneyProps = {
  completedPdfCount: number;
  finalizedPageCount: number;
  firstEditablePageId: string | null;
  manuscriptReady: boolean;
  pageCount: number;
  productAvailable: boolean;
  projectId: string;
  releaseCheckpointCount: number;
};

export function CloudCreationJourney({
  completedPdfCount,
  finalizedPageCount,
  firstEditablePageId,
  manuscriptReady,
  pageCount,
  productAvailable,
  projectId,
  releaseCheckpointCount,
}: CloudCreationJourneyProps) {
  const pagesFinished =
    pageCount > 0 && finalizedPageCount === pageCount && manuscriptReady;
  const steps = [
    {
      action: "話・ページを準備",
      complete: pageCount > 0,
      detail:
        "話とページ数を決めます。ページの追加・並び替えもここで行います。",
      href: "#project-structure",
      label: "構成を作る",
    },
    {
      action: firstEditablePageId ? "次のページを編集" : "原稿チェックを確認",
      complete: pagesFinished,
      detail: "各ページへコマ・画像・文字を配置し、ページを確定します。",
      href: firstEditablePageId
        ? `/creator/${projectId}/pages/${firstEditablePageId}`
        : "#project-details",
      label: "原稿を仕上げる",
    },
    {
      action: "完成版を固定",
      complete: releaseCheckpointCount > 0,
      detail:
        "全ページ確定後の状態を、販売・書き出し用の完成版として固定します。",
      href: "#project-checkpoints",
      label: "完成版を固定する",
    },
    {
      action: "PDF書き出しへ",
      complete: completedPdfCount > 0,
      detail: "固定した完成原稿から、安全に再開できるPDFを書き出します。",
      href: "#durable-export",
      label: "完成原稿を出力する",
    },
    {
      action: productAvailable ? "販売準備を確認" : "商品下書きを準備",
      complete: productAvailable,
      detail:
        "非公開作品と停止中の商品を準備します。公開・販売開始は別操作です。",
      href: "#marketplace-listing",
      label: "販売を準備する",
    },
  ];
  const currentIndex = steps.findIndex((step) => !step.complete);
  const resolvedIndex = currentIndex === -1 ? steps.length - 1 : currentIndex;
  const current = steps[resolvedIndex]!;

  return (
    <section
      aria-labelledby="cloud-creation-journey-heading"
      className="panel mt-6 border-violet-300 bg-violet-50/70"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-bold text-violet-700">
            <Compass className="h-4 w-4" />
            目的別・制作ステップ
          </p>
          <h2
            className="mt-1 text-2xl font-bold"
            id="cloud-creation-journey-heading"
          >
            今やること：{current.label}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-700">
            {current.detail}
          </p>
          <a className="button mt-4 inline-flex" href={current.href}>
            {current.action}
          </a>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1 text-sm font-bold text-violet-800">
          {steps.filter((step) => step.complete).length}/{steps.length} 完了
        </span>
      </div>
      <details className="mt-5 rounded-xl border border-violet-200 bg-white p-4">
        <summary className="cursor-pointer font-bold text-violet-950">
          全体の流れと完了状況を見る
        </summary>
        <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {steps.map((step, index) => {
            const Icon = step.complete ? CheckCircle2 : CircleDashed;
            return (
              <li
                className={`rounded-lg border p-3 text-sm ${
                  index === resolvedIndex
                    ? "border-violet-400 bg-violet-50"
                    : step.complete
                      ? "border-green-200 bg-green-50"
                      : "border-stone-200 bg-stone-50"
                }`}
                key={step.label}
              >
                <div className="flex items-center gap-2 font-bold">
                  <Icon className="h-4 w-4 shrink-0" />
                  {index + 1}. {step.label}
                </div>
                <a
                  className="mt-2 inline-block font-semibold underline"
                  href={step.href}
                >
                  {step.complete ? "確認する" : step.action}
                </a>
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}
