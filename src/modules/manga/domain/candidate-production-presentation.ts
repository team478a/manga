import type { PageCanvas } from "@mangai/canvas-core";
import type { CloudGenerationJob } from "../../cloud-creator/contracts/types.ts";

type Candidate = Pick<CloudGenerationJob, "id" | "page_id" | "kind" | "status" | "output_asset_id" | "target_panel_id" | "panel_adoption_status" | "panel_adoption_retryable" | "quality_review_status" | "failed_retry_recovery">;

export function panelHasVisibleProductionImage(canvas: PageCanvas, panelId: string) {
  const panel = canvas.panels.find(item => item.id === panelId && item.visible);
  if (!panel) return false;
  const separated = canvas.panelLayers.filter(layer => layer.panelId === panelId && layer.type !== "flattened_legacy");
  return separated.length
    ? separated.some(layer => layer.visible && layer.opacity > 0 && Boolean(layer.assetId))
    : Boolean(panel.imageAssetId && panel.imageOpacity > 0);
}

export function candidateIsVisibleInCanvas(job: Candidate, canvas: PageCanvas) {
  if (job.kind !== "image" || job.status !== "completed" || !job.output_asset_id || job.page_id !== canvas.pageId) return false;
  return canvas.panels.some(panel => {
    if (!panel.visible || (job.target_panel_id && panel.id !== job.target_panel_id)) return false;
    const separated = canvas.panelLayers.filter(layer => layer.panelId === panel.id && layer.type !== "flattened_legacy");
    return separated.length
      ? separated.some(layer => layer.visible && layer.opacity > 0 && layer.assetId === job.output_asset_id)
      : panel.imageAssetId === job.output_asset_id && panel.imageOpacity > 0;
  });
}

export function buildCandidateProductionPresentation(job: Candidate, canvas: PageCanvas, canvasSaved: boolean) {
  const generationLabel = job.status === "queued" || job.status === "running"
    ? "生成中"
    : job.status === "failed"
      ? job.failed_retry_recovery === "retryable" ? "生成失敗・再実行可能" : "生成失敗・条件の確認が必要"
      : job.status === "canceled" ? "中止"
        : job.kind === "text" ? "文章生成結果を保存済み"
          : job.output_asset_id ? "画像生成結果を保存済み" : "生成結果の画像を確認できません";
  const adoptionLabel = job.quality_review_status === "rejected" || job.panel_adoption_status === "rejected"
    ? "不採用"
    : job.quality_review_status === "approved" ? "採用確認済み" : "採用・品質確認待ち";
  const placementLabel = candidateIsVisibleInCanvas(job, canvas)
    ? canvasSaved ? "表示用Canvasに配置・保存済み" : "編集中のCanvasへ配置済み・未保存"
    : job.panel_adoption_status === "auto_placed" ? "保存先は配置済み・この画面では表示未確認"
      : job.panel_adoption_status === "placement_failed"
        ? job.panel_adoption_retryable ? "配置失敗・配置の再試行が必要（追加生成なし）" : "配置失敗・手動確認が必要"
        : job.panel_adoption_status === "review_required" ? "配置前の手動確認待ち" : "未配置";
  return { generationLabel, adoptionLabel, placementLabel };
}

export function missingPanelGenerationCounts(canvas: PageCanvas, jobs: Candidate[]) {
  const missing = new Set(canvas.panels.filter(panel => panel.visible && !panelHasVisibleProductionImage(canvas, panel.id)).map(panel => panel.id));
  const scoped = jobs.filter(job => job.kind === "image" && job.page_id === canvas.pageId && job.target_panel_id && missing.has(job.target_panel_id));
  const reusable = scoped.filter(job => job.status === "completed" && job.output_asset_id && job.quality_review_status !== "rejected" && job.panel_adoption_status !== "rejected");
  const progressingPanels = new Set(scoped.filter(job => job.status === "queued" || job.status === "running").concat(reusable).map(job => job.target_panel_id));
  return {
    missingPanelCount: missing.size,
    activeCount: scoped.filter(job => job.status === "queued" || job.status === "running").length,
    failedCount: scoped.filter(job => job.status === "failed" && !progressingPanels.has(job.target_panel_id)).length,
    completedCount: reusable.length,
  };
}
