import {
  DomainError,
  type DomainErrorCode,
  isDomainError,
} from "./domain-errors.ts";

export const cloudMarketplaceDraftFailureStages = [
  "draft_lookup",
  "artifact_preflight",
  "artifact_checkpoint_render",
  "artifact_pdf",
  "artifact_generation",
  "cover_upload",
  "pdf_upload",
  "page_upload",
  "database_sync",
] as const;

export type CloudMarketplaceDraftFailureStage =
  (typeof cloudMarketplaceDraftFailureStages)[number];

export class CloudMarketplaceDraftSyncError extends DomainError {
  readonly stage: CloudMarketplaceDraftFailureStage;

  constructor(
    stage: CloudMarketplaceDraftFailureStage,
    code: DomainErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(code, message, options);
    this.stage = stage;
  }
}

export function wrapCloudMarketplaceDraftError(
  stage: CloudMarketplaceDraftFailureStage,
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof CloudMarketplaceDraftSyncError) return error;
  return new CloudMarketplaceDraftSyncError(
    stage,
    isDomainError(error) ? error.code : "INTERNAL_ERROR",
    isDomainError(error) ? error.message : fallbackMessage,
    { cause: error },
  );
}

export function getCloudMarketplaceDraftFailureStage(error: unknown) {
  return error instanceof CloudMarketplaceDraftSyncError
    ? error.stage
    : "unclassified";
}
