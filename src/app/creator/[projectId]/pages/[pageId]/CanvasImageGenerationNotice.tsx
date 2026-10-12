import Link from "next/link";
import type { PageCanvas } from "@mangai/canvas-core";
import type { CloudGenerationJob } from "@/lib/cloud-creator-server";

import { missingPanelGenerationCounts } from "@/modules/manga/domain/candidate-production-presentation";

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
  const { missingPanelCount, activeCount, failedCount, completedCount } = missingPanelGenerationCounts(canvas, generationJobs);
  if (!missingPanelCount) return null;

  const title = activeCount
    ? "原稿画像を生成しています"
    : failedCount
      ? "生成できていないコマがあります"
      : completedCount
        ? "生成済み画像の配置確認が必要です"
        : "このページはまだ画像生成前です";
  const description = activeCount
    ? `画像のない${missingPanelCount}コマを対象に、${activeCount}件の生成処理が進行中です。画像生成後も採用・配置・保存の確認が必要です。`
    : failedCount
      ? `画像のないコマが${missingPanelCount}件、生成失敗が${failedCount}件あります。AI制作アシストの生成履歴から失敗したコマだけ再実行できます。`
      : completedCount
        ? `画像のないコマが${missingPanelCount}件あります。生成履歴で採用・配置状態を確認してください。保存済み画像の配置は追加生成ではありません。再読み込みだけで必ず配置されるわけではありません。`
        : "現在表示されているのはネーム（コマ枠・吹き出し・文字）で、完成原稿画像ではありません。見積りを確認し、対象ページを選んで画像生成を開始してください。";

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
          <p className="mt-1 text-xs font-bold">
            次の画面へ移動するだけでは生成・クレジット消費は始まりません。費用と対象を確認した後の明示操作が必要です。
          </p>
        </div>
        <Link
          className="button shrink-0"
          href={`/creator/${projectId}#page-generation`}
        >
          画像生成の見積り・開始へ
        </Link>
      </div>
    </section>
  );
}
