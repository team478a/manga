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

export type PanelCandidateAdoptionRisk =
  | "safe"
  | "replaces_existing_image"
  | "changes_completed_page";

const backgroundLayerTypes = new Set<PanelLayer["type"]>([
  "background",
  "flattened_legacy",
]);

export function assessPanelCandidateAdoptionRisk(
  canvas: PageCanvas,
  input: {
    assetId: string;
    layerType: PanelLayer["type"];
    pageComplete: boolean;
    sourceJobId: string | null;
    targetPanelId: string;
  },
): PanelCandidateAdoptionRisk {
  if (input.pageComplete) return "changes_completed_page";
  if (
    input.layerType !== "background" &&
    input.layerType !== "correction"
  )
    return "safe";
  const panel = canvas.panels.find((item) => item.id === input.targetPanelId);
  if (!panel?.imageAssetId || panel.imageAssetId === input.assetId) return "safe";
  if (
    canvas.panelLayers.some(
      (layer) =>
        layer.panelId === input.targetPanelId &&
        ((input.sourceJobId && layer.sourceJobId === input.sourceJobId) ||
          layer.assetId === input.assetId),
    )
  )
    return "safe";
  return "replaces_existing_image";
}

function byOrderIndex(left: PanelLayer, right: PanelLayer) {
  return left.orderIndex - right.orderIndex;
}

function reorderPanelLayers(
  layers: PanelLayer[],
  orderedLayers: PanelLayer[],
) {
  orderedLayers.forEach((layer, orderIndex) => {
    layer.orderIndex = orderIndex;
  });
  const orderedIds = new Set(orderedLayers.map((layer) => layer.id));
  layers
    .filter((layer) => !orderedIds.has(layer.id))
    .sort(byOrderIndex)
    .forEach((layer, index) => {
      layer.orderIndex = orderedLayers.length + index;
    });
}

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
  const adoptedLayer: PanelLayer = {
    id: adoption.layerId,
    panelId: panel.id,
    name: layerName,
    type: adoption.layerType,
    orderIndex:
      adoption.layerType === "background"
        ? 0
        : Math.max(-1, ...currentLayers.map((layer) => layer.orderIndex)) + 1,
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
  };
  canvas.panelLayers.push(adoptedLayer);
  if (adoption.layerType === "background") {
    const existingBackgrounds = currentLayers
      .filter((layer) => backgroundLayerTypes.has(layer.type))
      .sort(byOrderIndex);
    const foregroundLayers = currentLayers
      .filter((layer) => !backgroundLayerTypes.has(layer.type))
      .sort(byOrderIndex);
    reorderPanelLayers(currentLayers, [
      ...existingBackgrounds,
      adoptedLayer,
      ...foregroundLayers,
    ]);
  }
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
      .sort((left, right) => right.orderIndex - left.orderIndex)[0];
    panel.imageAssetId = replacement?.assetId ?? null;
  }
  return true;
}

function validUniqueBackgroundTimeline(layers: PanelLayer[]) {
  const timestamps = layers.map((layer) => Date.parse(layer.createdAt));
  return (
    timestamps.every(Number.isFinite) && new Set(timestamps).size === timestamps.length
  );
}

function panelHasReversedBackgroundStack(layers: PanelLayer[]) {
  const backgrounds = layers
    .filter(
      (layer) =>
        layer.type === "background" && Boolean(layer.assetId),
    )
    .sort(byOrderIndex);
  if (
    backgrounds.filter((layer) => layer.visible).length < 2 ||
    !validUniqueBackgroundTimeline(backgrounds)
  )
    return false;
  return backgrounds.some(
    (layer, index) =>
      index > 0 &&
      Date.parse(layer.createdAt) < Date.parse(backgrounds[index - 1].createdAt),
  );
}

export function countReversedPanelBackgroundStacks(canvas: PageCanvas) {
  return canvas.panels.filter((panel) =>
    panelHasReversedBackgroundStack(
      canvas.panelLayers.filter((layer) => layer.panelId === panel.id),
    ),
  ).length;
}

export function repairReversedPanelBackgroundStacks(
  canvas: PageCanvas,
  timestamp: string,
) {
  let repairedPanelCount = 0;
  for (const panel of canvas.panels) {
    const panelLayers = canvas.panelLayers.filter(
      (layer) => layer.panelId === panel.id,
    );
    if (!panelHasReversedBackgroundStack(panelLayers)) continue;
    const backgrounds = panelLayers
      .filter((layer) => layer.type === "background")
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
    const foregroundLayers = panelLayers
      .filter((layer) => layer.type !== "background")
      .sort(byOrderIndex);
    reorderPanelLayers(panelLayers, [...backgrounds, ...foregroundLayers]);
    backgrounds.forEach((layer) => {
      layer.updatedAt = timestamp;
    });
    const newestVisibleBackground = backgrounds
      .filter((layer) => layer.visible && Boolean(layer.assetId))
      .at(-1);
    if (newestVisibleBackground?.assetId)
      panel.imageAssetId = newestVisibleBackground.assetId;
    repairedPanelCount += 1;
  }
  return repairedPanelCount;
}
