import { pageCanvasSchema } from "@mangai/canvas-core";
import { ResourceNotFoundError, ValidationError } from "../../../lib/domain-errors.ts";

export type MangaGenerationBatch = {
  id: string;
  status: "active" | "paused" | "completed" | "canceled";
  requested_page_ids: string[];
  created_at: string;
  totalJobs: number;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  pendingTargets: number;
  failedTargets: number;
  failedJobIds: string[];
};

export function normalizeGenerationBatchPageIds(pageIds: string[]) {
  const uniquePageIds = [...new Set(pageIds)];
  if (!isGenerationBatchPageCountAllowed(uniquePageIds.length))
    throw new ValidationError("Pilotは連続2ページ、通常の一括生成は4〜8ページを選んでください。");
  return uniquePageIds;
}

export function isGenerationBatchPageCountAllowed(pageCount: number) {
  return pageCount === 2 || (pageCount >= 4 && pageCount <= 8);
}

export function isConsecutiveGenerationPilot(input: {
  pageIds: string[];
  pageNumbers: Record<string, number>;
}) {
  const uniquePageIds = [...new Set(input.pageIds)];
  if (uniquePageIds.length !== 2) return true;
  const pageNumbers = uniquePageIds.map((pageId) => input.pageNumbers[pageId]);
  return pageNumbers.every(Number.isInteger) && Math.abs(pageNumbers[0] - pageNumbers[1]) === 1;
}

export function planGenerationBatchTargets(input: {
  requestedPageIds: string[];
  pages: Array<{
    id: string;
    revision: number;
    cloud_canvas_snapshots: unknown;
  }>;
}) {
  if (input.pages.length !== input.requestedPageIds.length)
    throw new ResourceNotFoundError("一括生成対象のページが見つかりません。");
  const targets = input.pages.flatMap((page) => {
    const versions = Array.isArray(page.cloud_canvas_snapshots)
      ? page.cloud_canvas_snapshots
      : [];
    const current = versions.find(
      (snapshot): snapshot is { revision: number; canvas: unknown } =>
        typeof snapshot === "object" &&
        snapshot !== null &&
        "revision" in snapshot &&
        snapshot.revision === page.revision &&
        "canvas" in snapshot,
    );
    if (!current) return [];
    const canvas = pageCanvasSchema.parse(current.canvas);
    return canvas.panels.map((panel) => ({
      pageId: page.id,
      panelId: panel.id,
      sourcePageRevision: page.revision,
    }));
  });
  if (!targets.length)
    throw new ValidationError("選択したページに生成可能なコマがありません。");
  if (targets.length > 64)
    throw new ValidationError("一度に生成できるコマは64個までです。ページを分けてください。");
  return targets;
}

type PreparedGenerationBatchTarget = {
  providerId: string;
  modelId: string;
  pricingVersion: string;
  generation: {
    characterProfileVersions?: Array<{ profileId: string; version: number }>;
    styleBibleVersion?: { bibleId: string; version: number };
  };
};

export function assertPreparedGenerationBatchConsistency(input: {
  targets: PreparedGenerationBatchTarget[];
  expectedProviderId: string;
  expectedModelId: string;
  expectedPricingVersion: string;
  requireStyleBible: boolean;
}) {
  if (!input.targets.length)
    throw new ValidationError("一括生成条件を準備できませんでした。");
  const characterVersions = new Map<string, number>();
  let styleBible: { bibleId: string; version: number } | null = null;
  for (const target of input.targets) {
    if (
      target.providerId !== input.expectedProviderId ||
      target.modelId !== input.expectedModelId ||
      target.pricingVersion !== input.expectedPricingVersion
    )
      throw new ValidationError(
        "一括生成のProvider・model・料金設定が準備中に変更されました。内容を再確認してから開始してください。",
      );
    const targetStyle = target.generation.styleBibleVersion;
    if (input.requireStyleBible && !targetStyle)
      throw new ValidationError(
        "一括生成の画風設定を固定できませんでした。内容を再確認してから開始してください。",
      );
    if (targetStyle) {
      if (
        styleBible &&
        (styleBible.bibleId !== targetStyle.bibleId ||
          styleBible.version !== targetStyle.version)
      )
        throw new ValidationError(
          "一括生成の画風設定が準備中に更新されました。内容を再確認してから開始してください。",
        );
      styleBible = targetStyle;
    }
    for (const character of target.generation.characterProfileVersions ?? []) {
      const current = characterVersions.get(character.profileId);
      if (current !== undefined && current !== character.version)
        throw new ValidationError(
          "一括生成の人物設定が準備中に更新されました。内容を再確認してから開始してください。",
        );
      characterVersions.set(character.profileId, character.version);
    }
  }
}

export function summarizeGenerationBatches(input: {
  batches: Array<{
    id: string;
    status: MangaGenerationBatch["status"];
    requested_page_ids: string[];
    created_at: string;
  }>;
  links: Array<{ batch_id: string; job_id: string; status: string }>;
  targetProgress?: Array<{
    batch_id: string;
    pending_targets: number;
    failed_targets: number;
  }>;
}): MangaGenerationBatch[] {
  return input.batches.flatMap((batch) => {
    const jobs = input.links.filter((link) => link.batch_id === batch.id);
    if (batch.status === "canceled" && jobs.length === 0) return [];
    const count = (status: string) =>
      jobs.filter((job) => job.status === status).length;
    const targetProgress = input.targetProgress?.find(
      (item) => item.batch_id === batch.id,
    );
    const pendingTargets = targetProgress?.pending_targets ?? 0;
    const failedTargets = targetProgress?.failed_targets ?? 0;
    const status =
      batch.status === "active" && jobs.length > 0 && pendingTargets === 0 &&
        failedTargets === 0 && count("completed") === jobs.length
        ? "completed"
        : batch.status;
    return [{
      ...batch,
      status,
      totalJobs: jobs.length,
      queuedJobs: count("queued"),
      runningJobs: count("running"),
      completedJobs: count("completed"),
      failedJobs: count("failed"),
      pendingTargets,
      failedTargets,
      failedJobIds: jobs.filter((job) => job.status === "failed").map((job) => job.job_id),
    }];
  });
}
