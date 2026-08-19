import type { PageCanvas, PanelLayer } from "@mangai/canvas-core";

export type PanelCandidateAdoption = {
  assetId: string;
  assetFileName?: string;
  layerId: string;
  layerType: PanelLayer["type"];
  sourceJobId: string | null;
  targetPanelId: string;
  timestamp: string;
};

export type PanelCandidateAdoptionResult =
  | "applied"
  | "already_applied"
  | "panel_not_found";

export function applyPanelCandidateAdoptionResult(
  canvas: PageCanvas,
  adoption: PanelCandidateAdoption,
): PanelCandidateAdoptionResult {
  const panel = canvas.panels.find(
    (item) => item.id === adoption.targetPanelId,
  );
  if (!panel) return "panel_not_found";
  if (
    canvas.panelLayers.some(
      (layer) =>
        (adoption.sourceJobId && layer.sourceJobId === adoption.sourceJobId) ||
        (layer.panelId === panel.id && layer.assetId === adoption.assetId),
    )
  )
    return "already_applied";
  if (
    adoption.layerType === "background" ||
    adoption.layerType === "correction"
  )
    panel.imageAssetId = adoption.assetId;
  const currentLayers = canvas.panelLayers.filter(
    (layer) => layer.panelId === panel.id,
  );
  const layerName =
    adoption.layerType === "character"
      ? "AI人物レイヤー"
      : adoption.layerType === "effect"
        ? "AI効果レイヤー"
        : adoption.layerType === "background"
          ? "AI背景レイヤー"
          : (adoption.assetFileName ?? "画像レイヤー");
  if (adoption.layerType === "background") {
    currentLayers
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .forEach((layer, index) => {
        layer.orderIndex = index + 1;
      });
  }
  const orderIndex =
    adoption.layerType === "background"
      ? 0
      : Math.max(-1, ...currentLayers.map((layer) => layer.orderIndex)) + 1;
  canvas.panelLayers.push({
    id: adoption.layerId,
    panelId: panel.id,
    name: layerName,
    type: adoption.layerType,
    orderIndex,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode:
      adoption.layerType === "character" || adoption.layerType === "effect"
        ? "multiply"
        : "normal",
    assetId: adoption.assetId,
    sourceJobId: adoption.sourceJobId,
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    createdAt: adoption.timestamp,
    updatedAt: adoption.timestamp,
  });
  return "applied";
}

export function applyPanelCandidateAdoption(
  canvas: PageCanvas,
  adoption: PanelCandidateAdoption,
) {
  return applyPanelCandidateAdoptionResult(canvas, adoption) !== "panel_not_found";
}

export function detachRejectedPanelCandidate(
  canvas: PageCanvas,
  sourceJobId: string,
) {
  const rejectedLayers = canvas.panelLayers.filter(
    (layer) => layer.sourceJobId === sourceJobId,
  );
  if (!rejectedLayers.length) return false;
  const affectedPanelIds = new Set(rejectedLayers.map((layer) => layer.panelId));
  const rejectedAssetIds = new Set(
    rejectedLayers.flatMap((layer) => (layer.assetId ? [layer.assetId] : [])),
  );
  canvas.panelLayers = canvas.panelLayers.filter(
    (layer) => layer.sourceJobId !== sourceJobId,
  );
  for (const panel of canvas.panels) {
    if (
      !affectedPanelIds.has(panel.id) ||
      !panel.imageAssetId ||
      !rejectedAssetIds.has(panel.imageAssetId)
    )
      continue;
    const replacement = canvas.panelLayers
      .filter(
        (layer) =>
          layer.panelId === panel.id &&
          layer.visible &&
          Boolean(layer.assetId) &&
          (layer.type === "background" ||
            layer.type === "correction" ||
            layer.type === "flattened_legacy"),
      )
      .sort((left, right) => left.orderIndex - right.orderIndex)[0];
    panel.imageAssetId = replacement?.assetId ?? null;
  }
  return true;
}
