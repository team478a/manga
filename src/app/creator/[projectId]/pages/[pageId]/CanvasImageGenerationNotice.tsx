import Link from "next/link";
import type { PageCanvas } from "@mangai/canvas-core";
import type { CloudGenerationJob } from "@/lib/cloud-creator-server";

function panelHasImage(canvas: PageCanvas, panelId: string) {
  const panel = canvas.panels.find((candidate) => candidate.id === panelId);
  return Boolean(
    panel?.imageAssetId ||
      canvas.panelLayers.some(
        (layer) =>
          layer.panelId === panelId && layer.visible && Boolean(layer.assetId),
      ),
  );
}

export function CanvasImageGenerationNotice({
  canvas,
  generationJobs,
  projectId,
  storyboardPanelGenerationEnabled,
}: {
  canvas: PageCanvas;
  generationJobs: CloudGenerationJob[];
  projectId: string;
  storyboardPanelGenerationEnabled: boolean;
}) {
  const missingPanelCount = canvas.panels.filter(
    (panel) => panel.visible && !panelHasImage(canvas, panel.id),
  ).length;
  if (!missingPanelCount) return null;

  const panelImageJobs = generationJobs.filter(
    (job) => job.kind === "image" && Boolean(job.target_panel_id),
  );
  const activeCount = panelImageJobs.filter(
    (job) => job.status === "queued" || job.status === "running",
  ).length;
  const failedCount = panelImageJobs.filter(
    (job) => job.status === "failed",
  ).length;
  const completedCount = panelImageJobs.filter(
    (job) => job.status === "completed" && Boolean(job.output_asset_id),
  ).length;

  const title = activeCount
    ? "原稿画像を生成しています"
    : failedCount
      ? "生成できていないコマがあります"
      : completedCount
        ? "生成済み画像の配置確認が必要です"
        : "このページはまだ画像生成前です";
  const description = activeCount
    ? `画像のない${missingPanelCount}コマのうち、${activeCount}件を処理中です。完了後に再読み込みすると原稿へ反映されます。`
    : failedCount
      ? `画像のないコマが${missingPanelCount}件、生成失敗が${failedCount}件あります。AI制作アシストの生成履歴から失敗したコマだけ再実行できます。`
      : completedCount
        ? `画像のないコマが${missingPanelCount}件あります。生成履歴の「手動確認待ち」から採用画像を選んでください。`
        : "現在表示されているのはネーム（コマ枠・吹き出し・文字）で、完成原稿画像ではありません。画像生成を開始してください。";

  return (
    <section
      aria-labelledby="canvas-image-generation-status"
      className="mx-auto max-w-[1600px] border-y border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
      role="alert"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <strong id="canvas-image-generation-status">{title}</strong>
          <p className="mt-1">{description}</p>
          {storyboardPanelGenerationEnabled ? (
            <p className="mt-1 text-xs">
              1コマだけ作る場合は、原稿上のコマを選び、左側の「AI制作アシスト」から生成できます。
            </p>
          ) : null}
        </div>
        <Link
          className="button shrink-0"
          href={`/creator/${projectId}#page-generation`}
        >
          まとめて画像生成へ
        </Link>
      </div>
    </section>
  );
}
