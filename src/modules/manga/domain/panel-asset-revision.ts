import type { PageCanvas, PanelLayer } from "@mangai/canvas-core";

export type PanelAssetRevisionOperation = "adoption" | "revision" | "inpainting" | "outpainting" | "manual";
export type PanelAssetRevision = { revision: number; layerId: string; assetId: string; sourceJobId: string | null; sourceAssetId: string | null; operation: PanelAssetRevisionOperation; createdAt: string; active: boolean };
export type PanelAssetRevisionJob = { id: string; source_asset_id: string | null; generation_operation: "text_to_image" | "image_to_image" | "inpainting" | "outpainting" | null; revision_preset: string | null };

const compositeTypes = new Set<PanelLayer["type"]>(["background", "correction", "flattened_legacy"]);
const sameTrack = (left: PanelLayer, right: PanelLayer) => compositeTypes.has(left.type) ? compositeTypes.has(right.type) : left.type === right.type;

export function listPanelAssetRevisions(canvas: PageCanvas, panelId: string, jobs: PanelAssetRevisionJob[]): PanelAssetRevision[] {
  const panel = canvas.panels.find((value) => value.id === panelId);
  if (!panel) return [];
  const jobMap = new Map(jobs.map((job) => [job.id, job]));
  return canvas.panelLayers.filter((layer) => layer.panelId === panelId && Boolean(layer.assetId) && compositeTypes.has(layer.type))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.orderIndex - right.orderIndex)
    .map((layer, index) => {
      const job = layer.sourceJobId ? jobMap.get(layer.sourceJobId) : undefined;
      const operation: PanelAssetRevisionOperation = job?.generation_operation === "inpainting" ? "inpainting" : job?.generation_operation === "outpainting" ? "outpainting" : job?.source_asset_id || job?.revision_preset ? "revision" : layer.sourceJobId ? "adoption" : "manual";
      return { revision: index + 1, layerId: layer.id, assetId: layer.assetId!, sourceJobId: layer.sourceJobId, sourceAssetId: job?.source_asset_id ?? null, operation, createdAt: layer.createdAt, active: compositeTypes.has(layer.type) ? panel.imageAssetId === layer.assetId && layer.visible : layer.visible };
    });
}

export function restorePanelAssetRevision(canvas: PageCanvas, panelId: string, layerId: string, timestamp: string) {
  const panel = canvas.panels.find((value) => value.id === panelId);
  const target = canvas.panelLayers.find((layer) => layer.id === layerId && layer.panelId === panelId && Boolean(layer.assetId));
  if (!panel || !target?.assetId || !compositeTypes.has(target.type)) return false;
  for (const layer of canvas.panelLayers) {
    if (layer.panelId !== panelId || !sameTrack(target, layer) || !layer.assetId) continue;
    layer.visible = layer.id === target.id;
    layer.updatedAt = timestamp;
  }
  if (compositeTypes.has(target.type)) panel.imageAssetId = target.assetId;
  return true;
}
