import type { PanelLayer } from "@mangai/canvas-core";

export type PanelGenerationTarget =
  "composite" | "background" | "character" | "effect";

export type ComparisonDirection =
  "left" | "right" | "top" | "bottom" | "all" | null;

export type ComparisonFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type CandidateJob = {
  id: string;
  page_id?: string | null;
  target_panel_id: string | null;
  output_asset_id: string | null;
  generation_operation: string | null;
  job_type: string;
};

type CandidateJobStatus = Pick<CandidateJob, "id" | "target_panel_id"> & {
  status: string;
  panel_adoption_status?: string | null;
  quality_review_status?: string | null;
};

export function filterGenerationJobsForPage<T extends { page_id: string | null }>(
  jobs: readonly T[],
  pageId: string,
) {
  return jobs.filter((job) => job.page_id === pageId);
}

export function candidateBelongsToPage(
  job: Pick<CandidateJob, "page_id">,
  pageId: string,
) {
  return job.page_id === pageId;
}

export function hasUnresolvedPanelGeneration(
  jobs: readonly CandidateJobStatus[],
  panelId: string,
  excludedJobId?: string,
) {
  return jobs.some(
    (job) =>
      job.id !== excludedJobId &&
      job.target_panel_id === panelId &&
      (job.status === "queued" ||
        job.status === "running" ||
        (job.status === "completed" &&
          job.panel_adoption_status !== "auto_placed" &&
          job.quality_review_status !== "rejected")),
  );
}

const percent = (value: number) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 100));

export function resolveComparisonSourceFrame(input: {
  beforeWidth: number;
  beforeHeight: number;
  afterWidth: number;
  afterHeight: number;
  direction: ComparisonDirection;
}): ComparisonFrame {
  if (!input.direction) return { left: 0, top: 0, width: 100, height: 100 };
  const width = percent((input.beforeWidth / input.afterWidth) * 100);
  const height = percent((input.beforeHeight / input.afterHeight) * 100);
  const horizontalGap = 100 - width;
  const verticalGap = 100 - height;
  return {
    left:
      input.direction === "left"
        ? horizontalGap
        : input.direction === "right"
          ? 0
          : horizontalGap / 2,
    top:
      input.direction === "top"
        ? verticalGap
        : input.direction === "bottom"
          ? 0
          : verticalGap / 2,
    width,
    height,
  };
}

export function resolveCandidateTargetPanelId(input: {
  job: CandidateJob;
  generationTargets: Readonly<Record<string, string>>;
  selectedPanelId: string | null;
}) {
  return (
    input.generationTargets[input.job.id] ??
    input.job.target_panel_id ??
    input.selectedPanelId
  );
}

export function classifyCandidateLayer(job: CandidateJob): PanelLayer["type"] {
  if (
    job.generation_operation === "inpainting" ||
    job.generation_operation === "outpainting"
  )
    return "correction";
  if (job.job_type === "character_base") return "character";
  if (job.job_type === "prop") return "prop";
  if (job.job_type === "effect") return "effect";
  return "background";
}
