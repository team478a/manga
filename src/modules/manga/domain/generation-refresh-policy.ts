import type { CloudGenerationJob } from "../../cloud-creator/contracts/types.ts";

type Job = Pick<CloudGenerationJob, "id" | "kind" | "status" | "page_id" | "output_asset_id" | "panel_adoption_eligible" | "panel_adoption_status" | "panel_adoption_retryable" | "quality_review_status">;

export function needsGenerationRefresh(jobs: Job[], pageId: string) {
  return jobs.some(job => job.page_id === pageId && (
    job.status === "queued" || job.status === "running" ||
    (job.status === "completed" && job.kind === "image" && job.output_asset_id &&
      job.quality_review_status !== "rejected" && job.panel_adoption_eligible &&
      (!job.panel_adoption_status ||
        (job.panel_adoption_status === "placement_failed" && job.panel_adoption_retryable)))
  ));
}

export function newAutoPlacementIds(previous: Job[], current: Job[], pageId: string) {
  const alreadyPlaced = new Set(previous.filter(job => job.panel_adoption_status === "auto_placed").map(job => job.id));
  return current.filter(job => job.page_id === pageId && job.kind === "image" &&
    job.status === "completed" && job.output_asset_id && job.panel_adoption_status === "auto_placed" &&
    job.quality_review_status !== "rejected" && !alreadyPlaced.has(job.id)).map(job => job.id);
}

export function generationRefreshKey(jobs: Job[], pageId: string) {
  return jobs.filter(job => needsGenerationRefresh([job], pageId))
    .map(job => `${job.id}:${job.status}:${job.panel_adoption_status ?? "pending"}`).sort().join("|");
}

export function autoPlacementRefreshDecision(input: {
  newPlacement: boolean;
  visibleInCanvas: boolean;
  saveState: string;
  unsaved: boolean;
  editLockAcquired: boolean;
  previouslyBlocked: boolean;
}) {
  if (!input.newPlacement || input.visibleInCanvas) return "none";
  return input.saveState === "saved" && !input.unsaved && input.editLockAcquired && !input.previouslyBlocked
    ? "reload" : "manual";
}

export function candidateDisplayCanBeRecorded(input: {
  loaded: boolean;
  naturalWidth: number;
  naturalHeight: number;
  intersecting: boolean;
  documentVisible: boolean;
}) {
  return input.loaded && input.naturalWidth > 0 && input.naturalHeight > 0 &&
    input.intersecting && input.documentVisible;
}
