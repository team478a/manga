import type { CloudManuscriptPageProgress } from "@/lib/cloud-manuscript-preflight";

export type CloudProductionJob = {
  page_id: string | null;
  target_panel_id: string | null;
  operation_id?: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  created_at: string;
};

export type CloudProductionPageProgress = CloudManuscriptPageProgress & {
  queuedPanelCount: number;
  runningPanelCount: number;
  failedPanelCount: number;
  status: "not_started" | "generating" | "needs_attention" | "images_ready";
};

export function buildCloudProductionProgress(input: {
  pages: CloudManuscriptPageProgress[];
  jobs: CloudProductionJob[];
}) {
  const operationGroups = new Map<string, CloudProductionJob[]>();
  for (const job of input.jobs) {
    if (!job.page_id || !job.target_panel_id) continue;
    const target = `${job.page_id}:${job.target_panel_id}`;
    const key = `${target}:${job.operation_id ?? job.created_at}`;
    operationGroups.set(key, [...(operationGroups.get(key) ?? []), job]);
  }
  const latestByTarget = new Map<string, CloudProductionJob[]>();
  for (const job of [...input.jobs].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  )) {
    if (!job.page_id || !job.target_panel_id) continue;
    const target = `${job.page_id}:${job.target_panel_id}`;
    if (latestByTarget.has(target)) continue;
    const operationKey = `${target}:${job.operation_id ?? job.created_at}`;
    latestByTarget.set(target, operationGroups.get(operationKey) ?? [job]);
  }

  const pages: CloudProductionPageProgress[] = input.pages.map((page) => {
    const targetGroups = [...latestByTarget.values()].filter(
      (jobs) => jobs[0]?.page_id === page.pageId,
    );
    const queuedPanelCount = targetGroups.filter(
      (jobs) =>
        !jobs.some((job) => job.status === "running") &&
        jobs.some((job) => job.status === "queued"),
    ).length;
    const runningPanelCount = targetGroups.filter((jobs) =>
      jobs.some((job) => job.status === "running"),
    ).length;
    const failedPanelCount = targetGroups.filter(
      (jobs) =>
        !jobs.some((job) => job.status === "running" || job.status === "queued") &&
        jobs.some((job) => job.status === "failed"),
    ).length;
    const status =
      page.totalPanelCount > 0 &&
      page.completedPanelCount === page.totalPanelCount
        ? "images_ready"
        : failedPanelCount > 0
          ? "needs_attention"
          : queuedPanelCount + runningPanelCount > 0
            ? "generating"
            : "not_started";
    return {
      ...page,
      queuedPanelCount,
      runningPanelCount,
      failedPanelCount,
      status,
    };
  });

  return {
    pages,
    imageReadyPageCount: pages.filter((page) => page.status === "images_ready").length,
    generatingPageCount: pages.filter((page) => page.status === "generating").length,
    failedPageCount: pages.filter((page) => page.status === "needs_attention").length,
  };
}
