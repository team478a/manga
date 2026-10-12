import { ResourceNotFoundError, ValidationError } from "../../../lib/domain-errors.ts";
import {
  adoptCompletedPanelCandidate,
  type AutomaticPanelAdoptionRepository,
  type AutomaticPanelAdoptionStatus,
} from "./auto-adopt-completed-panel.ts";

export type PlacementRetryCandidate = {
  creatorProfileId: string;
  ownerProfileId: string;
  pageId: string | null;
  kind: string;
  status: string;
  outputAssetId: string | null;
  placementStatus: AutomaticPanelAdoptionStatus | null;
  retryable: boolean;
  rejected: boolean;
};

// This dependency contract has no Provider, generation queue, or credit operation.
export async function retrySavedPanelPlacement(input: {
  jobId: string;
  pageId: string;
  profileId: string;
  loadCandidate(jobId: string): Promise<PlacementRetryCandidate | null>;
  createRepository(): AutomaticPanelAdoptionRepository;
}) {
  const candidate = await input.loadCandidate(input.jobId);
  if (!candidate || candidate.creatorProfileId !== input.profileId ||
      candidate.ownerProfileId !== input.profileId || candidate.pageId !== input.pageId)
    throw new ResourceNotFoundError();
  if (candidate.kind !== "image" || candidate.status !== "completed" || !candidate.outputAssetId)
    throw new ValidationError("保存済みの完了画像だけ配置を再試行できます。");
  if (candidate.rejected || candidate.placementStatus === "rejected")
    return { status: "rejected" as const };
  if (candidate.placementStatus === "auto_placed")
    return { status: "auto_placed" as const, noOp: true };
  if (candidate.placementStatus === "review_required")
    return { status: "review_required" as const, noOp: true };
  if (candidate.placementStatus !== "placement_failed" || !candidate.retryable)
    throw new ValidationError("この候補は配置だけの再試行対象ではありません。手動で確認してください。");

  const repository = input.createRepository();
  return adoptCompletedPanelCandidate({
    jobId: input.jobId,
    repository: {
      ...repository,
      async load(jobId) {
        // Recheck permission/rejection/retryability on conflict reloads as well.
        const current = await input.loadCandidate(jobId);
        if (!current || current.creatorProfileId !== input.profileId ||
            current.ownerProfileId !== input.profileId || current.pageId !== input.pageId ||
            current.kind !== "image" || current.status !== "completed" || !current.outputAssetId)
          return null;
        const context = await repository.load(jobId);
        if (!context || context.jobId !== jobId || context.pageId !== input.pageId || context.assetId !== current.outputAssetId)
          return null;
        if (current.rejected) return { ...context, existingStatus: "rejected" };
        if (current.placementStatus === "placement_failed" && !current.retryable) return null;
        if (!current.placementStatus) return null;
        return { ...context, existingStatus: current.placementStatus };
      },
    },
  });
}

export type PlacementRetryResult = Awaited<ReturnType<typeof retrySavedPanelPlacement>>;
