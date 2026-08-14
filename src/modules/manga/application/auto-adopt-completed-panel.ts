import crypto from "node:crypto";
import type { PageCanvas, PanelLayer } from "@mangai/canvas-core";
import {
  applyPanelCandidateAdoptionResult,
} from "../domain/panel-adoption.ts";
import { inspectAutomaticPanelAdoption } from "../domain/automatic-panel-adoption.ts";

export type AutomaticPanelAdoptionStatus =
  | "auto_placed"
  | "review_required"
  | "placement_failed"
  | "rejected";

export type AutomaticPanelAdoptionContext = {
  jobId: string;
  pageId: string;
  panelId: string;
  assetId: string;
  assetFileName?: string;
  sourcePageRevision: number;
  currentPageRevision: number;
  productionStatus: string;
  jobType: string;
  generationOperation: string | null;
  sourceAssetId: string | null;
  canvas: PageCanvas;
  existingStatus: AutomaticPanelAdoptionStatus | null;
};

export type AutomaticPanelAdoptionRepository = {
  load(jobId: string): Promise<AutomaticPanelAdoptionContext | null>;
  save(input: {
    jobId: string;
    expectedRevision: number;
    canvas: PageCanvas;
  }): Promise<{ revision: number }>;
  record(input: {
    jobId: string;
    status: AutomaticPanelAdoptionStatus;
    reasonCode: string | null;
    retryable: boolean;
    appliedRevision?: number;
  }): Promise<void>;
};

export class AutomaticPanelAdoptionRevisionConflictError extends Error {}

function classifyLayer(context: AutomaticPanelAdoptionContext): PanelLayer["type"] {
  if (
    context.generationOperation === "inpainting" ||
    context.generationOperation === "outpainting"
  )
    return "correction";
  if (context.jobType === "character_base") return "character";
  if (context.jobType === "prop") return "prop";
  if (context.jobType === "effect") return "effect";
  return "background";
}

async function recordReview(
  repository: AutomaticPanelAdoptionRepository,
  jobId: string,
  reasonCode: string,
) {
  await repository.record({
    jobId,
    status: "review_required",
    reasonCode,
    retryable: false,
  });
  return { status: "review_required" as const, reasonCode };
}

export async function adoptCompletedPanelCandidate(input: {
  jobId: string;
  repository: AutomaticPanelAdoptionRepository;
  now?: () => string;
  createId?: () => string;
  maxAttempts?: number;
}) {
  const now = input.now ?? (() => new Date().toISOString());
  const createId = input.createId ?? (() => crypto.randomUUID());
  const maxAttempts = Math.max(1, Math.min(input.maxAttempts ?? 2, 2));

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const context = await input.repository.load(input.jobId);
    if (!context) return { status: "not_eligible" as const };
    if (context.existingStatus === "rejected")
      return { status: "rejected" as const };
    if (context.existingStatus === "auto_placed")
      return { status: "auto_placed" as const, noOp: true };
    if (context.existingStatus === "review_required")
      return { status: "review_required" as const, noOp: true };
    const layerType = classifyLayer(context);
    const inspection = inspectAutomaticPanelAdoption({
      canvas: context.canvas,
      panelId: context.panelId,
      generationJobId: context.jobId,
      assetId: context.assetId,
      layerType,
      sourceAssetId: context.sourceAssetId,
    });
    if (inspection.decision === "already_applied") {
      await input.repository.record({
        jobId: input.jobId,
        status: "auto_placed",
        reasonCode: "already_applied",
        retryable: false,
        appliedRevision: context.currentPageRevision,
      });
      return { status: "auto_placed" as const, noOp: true };
    }
    if (context.productionStatus === "finalized")
      return recordReview(input.repository, input.jobId, "page_finalized");
    if (context.currentPageRevision !== context.sourcePageRevision)
      return recordReview(input.repository, input.jobId, "source_revision_changed");
    if (inspection.decision === "review_required")
      return recordReview(
        input.repository,
        input.jobId,
        inspection.reason,
      );

    const adoption = applyPanelCandidateAdoptionResult(context.canvas, {
      assetId: context.assetId,
      assetFileName: context.assetFileName,
      layerId: createId(),
      layerType,
      sourceJobId: context.jobId,
      targetPanelId: context.panelId,
      timestamp: now(),
    });
    if (adoption === "panel_not_found")
      return recordReview(input.repository, input.jobId, "panel_missing");
    try {
      const saved = await input.repository.save({
        jobId: input.jobId,
        expectedRevision: context.currentPageRevision,
        canvas: context.canvas,
      });
      return { status: "auto_placed" as const, revision: saved.revision };
    } catch (error) {
      if (
        error instanceof AutomaticPanelAdoptionRevisionConflictError &&
        attempt + 1 < maxAttempts
      )
        continue;
      await input.repository.record({
        jobId: input.jobId,
        status:
          error instanceof AutomaticPanelAdoptionRevisionConflictError
            ? "review_required"
            : "placement_failed",
        reasonCode:
          error instanceof AutomaticPanelAdoptionRevisionConflictError
            ? "revision_conflict"
            : "persistence_failed",
        retryable: !(error instanceof AutomaticPanelAdoptionRevisionConflictError),
      });
      return {
        status:
          error instanceof AutomaticPanelAdoptionRevisionConflictError
            ? ("review_required" as const)
            : ("placement_failed" as const),
      };
    }
  }
  return { status: "review_required" as const };
}
