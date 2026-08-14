import type { PageCanvas, PanelLayer } from "@mangai/canvas-core";

export type AutomaticPanelAdoptionBlockReason =
  | "panel_missing"
  | "panel_locked"
  | "target_layer_locked"
  | "manual_image_present";

export type AutomaticPanelAdoptionInspection =
  | { decision: "apply" }
  | { decision: "already_applied" }
  | { decision: "review_required"; reason: AutomaticPanelAdoptionBlockReason };

export function inspectAutomaticPanelAdoption(input: {
  canvas: PageCanvas;
  panelId: string;
  generationJobId: string;
  assetId: string;
  layerType: PanelLayer["type"];
  sourceAssetId: string | null;
}): AutomaticPanelAdoptionInspection {
  const panel = input.canvas.panels.find((item) => item.id === input.panelId);
  if (!panel) return { decision: "review_required", reason: "panel_missing" };
  const layers = input.canvas.panelLayers.filter(
    (layer) => layer.panelId === panel.id,
  );
  if (
    layers.some(
      (layer) =>
        layer.sourceJobId === input.generationJobId ||
        layer.assetId === input.assetId,
    )
  )
    return { decision: "already_applied" };
  if (panel.locked)
    return { decision: "review_required", reason: "panel_locked" };
  const targetLayers = layers.filter((layer) => layer.type === input.layerType);
  if (targetLayers.some((layer) => layer.locked))
    return { decision: "review_required", reason: "target_layer_locked" };

  const replacesPanelImage =
    input.layerType === "background" || input.layerType === "correction";
  if (replacesPanelImage && panel.imageAssetId) {
    const isExpectedRevisionSource =
      input.layerType === "correction" &&
      input.sourceAssetId === panel.imageAssetId;
    if (!isExpectedRevisionSource)
      return { decision: "review_required", reason: "manual_image_present" };
  }
  if (
    !replacesPanelImage &&
    targetLayers.some((layer) => layer.assetId !== null)
  )
    return { decision: "review_required", reason: "manual_image_present" };
  return { decision: "apply" };
}
