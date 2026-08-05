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

export function applyPanelCandidateAdoption(
  canvas: PageCanvas,
  adoption: PanelCandidateAdoption,
) {
  const panel = canvas.panels.find(
    (item) => item.id === adoption.targetPanelId,
  );
  if (!panel) return false;
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
  const orderIndex =
    adoption.layerType === "background"
      ? Math.min(0, ...currentLayers.map((layer) => layer.orderIndex)) - 1
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
  return true;
}
