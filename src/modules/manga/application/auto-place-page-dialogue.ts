import crypto from "node:crypto";
import type { PageCanvas } from "@mangai/canvas-core";
import {
  placeStructuredPageDialogue,
  type DialoguePlacementBlocker,
  type StructuredPageDialogue,
} from "../domain/dialogue-placement.ts";

export type PageDialoguePlacementStatus =
  | "auto_placed"
  | "review_required"
  | "placement_failed";

export type PageDialoguePlacementContext = {
  jobId: string;
  pageId: string;
  currentPageRevision: number;
  productionStatus: string;
  imagesReady: boolean;
  canvas: PageCanvas;
  panels: StructuredPageDialogue[];
  existingStatus: PageDialoguePlacementStatus | null;
};

export type PageDialoguePlacementRepository = {
  load(jobId: string): Promise<PageDialoguePlacementContext | null>;
  save(input: {
    jobId: string;
    expectedRevision: number;
    canvas: PageCanvas;
    status: "auto_placed" | "review_required";
    dialogueCount: number;
    placedDialogueCount: number;
    blockerCodes: DialoguePlacementBlocker[];
  }): Promise<{ revision: number }>;
  record(input: {
    jobId: string;
    status: PageDialoguePlacementStatus;
    dialogueCount: number;
    placedDialogueCount: number;
    blockerCodes: DialoguePlacementBlocker[];
    retryable: boolean;
  }): Promise<void>;
};

export class PageDialoguePlacementRevisionConflictError extends Error {}

export async function placeCompletedPageDialogue(input: {
  jobId: string;
  repository: PageDialoguePlacementRepository;
  createId?: () => string;
  now?: () => string;
  maxAttempts?: number;
}) {
  const createId = input.createId ?? (() => crypto.randomUUID());
  const now = input.now ?? (() => new Date().toISOString());
  const maxAttempts = Math.max(1, Math.min(input.maxAttempts ?? 2, 2));

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const context = await input.repository.load(input.jobId);
    if (!context) return { status: "not_eligible" as const };
    if (context.existingStatus)
      return { status: context.existingStatus, noOp: true };
    if (!context.imagesReady) return { status: "not_ready" as const };
    if (context.productionStatus === "finalized") {
      await input.repository.record({
        jobId: input.jobId,
        status: "review_required",
        dialogueCount: 0,
        placedDialogueCount: 0,
        blockerCodes: ["page_finalized"],
        retryable: false,
      });
      return { status: "review_required" as const };
    }

    const placement = placeStructuredPageDialogue({
      canvas: context.canvas,
      panels: context.panels,
      createId,
      now: now(),
    });
    const status = placement.blockers.length
      ? ("review_required" as const)
      : ("auto_placed" as const);
    try {
      if (placement.changed) {
        const saved = await input.repository.save({
          jobId: input.jobId,
          expectedRevision: context.currentPageRevision,
          canvas: placement.canvas,
          status,
          dialogueCount: placement.dialogueCount,
          placedDialogueCount: placement.placedDialogueCount,
          blockerCodes: placement.blockers,
        });
        return { status, revision: saved.revision, ...placement };
      }
      await input.repository.record({
        jobId: input.jobId,
        status,
        dialogueCount: placement.dialogueCount,
        placedDialogueCount: placement.placedDialogueCount,
        blockerCodes: placement.blockers,
        retryable: false,
      });
      return { status, noOp: true, ...placement };
    } catch (error) {
      if (
        error instanceof PageDialoguePlacementRevisionConflictError &&
        attempt + 1 < maxAttempts
      )
        continue;
      await input.repository.record({
        jobId: input.jobId,
        status:
          error instanceof PageDialoguePlacementRevisionConflictError
            ? "review_required"
            : "placement_failed",
        dialogueCount: placement.dialogueCount,
        placedDialogueCount: placement.placedDialogueCount,
        blockerCodes: placement.blockers,
        retryable: !(error instanceof PageDialoguePlacementRevisionConflictError),
      });
      return {
        status:
          error instanceof PageDialoguePlacementRevisionConflictError
            ? ("review_required" as const)
            : ("placement_failed" as const),
      };
    }
  }
  return { status: "review_required" as const };
}
