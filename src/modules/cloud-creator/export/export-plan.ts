import type { PageCanvas } from "@mangai/canvas-core";

export type ExportJobClaim = {
  id: string;
  projectId: string;
  ownerProfileId: string;
  pageIds: string[];
  totalPages: number;
  completedPages: number;
  segmentSize: number;
  leaseToken: string;
  format: "pdf" | "images" | "project_json";
};

export function visibleCanvasAssetIds(canvas: PageCanvas) {
  const ids = new Set<string>();
  for (const panel of canvas.panels.filter((item) => item.visible)) {
    const layers = canvas.panelLayers.filter(
      (layer) => layer.panelId === panel.id && layer.visible && layer.assetId,
    );
    const separated = layers.filter(
      (layer) => layer.type !== "flattened_legacy",
    );
    if (separated.length) {
      for (const layer of separated) if (layer.assetId) ids.add(layer.assetId);
    } else if (panel.imageAssetId) {
      ids.add(panel.imageAssetId);
    }
  }
  return ids;
}

export function planExportSegment(job: ExportJobClaim) {
  const pageIds = job.pageIds.slice(
    job.completedPages,
    job.completedPages + job.segmentSize,
  );
  return {
    pageIds,
    segmentIndex: Math.floor(job.completedPages / job.segmentSize),
    completedPages: job.completedPages + pageIds.length,
    isFinal: job.completedPages + pageIds.length === job.totalPages,
  };
}

export function exportPageFileName(pageNumber: number) {
  return `${String(pageNumber).padStart(3, "0")}.png`;
}

export function exportJobPath(
  job: Pick<ExportJobClaim, "ownerProfileId" | "projectId" | "id">,
  suffix: string,
) {
  return `${job.ownerProfileId}/${job.projectId}/${job.id}/${suffix}`;
}
