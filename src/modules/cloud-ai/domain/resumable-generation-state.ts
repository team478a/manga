export type LegacyCloudGenerationStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "canceled";

export type CloudGenerationExecutionPhase =
  | "queued"
  | "preparing"
  | "generating"
  | "validating"
  | "succeeded"
  | "failed"
  | "canceled"
  | "unknown";

export type CloudGenerationRetryDisposition =
  | "automatic"
  | "manual"
  | "none";

export type ResumableCloudGenerationState =
  | "QUEUED"
  | "PREPARING"
  | "GENERATING"
  | "VALIDATING"
  | "SUCCEEDED"
  | "FAILED_RETRYABLE"
  | "FAILED_FINAL"
  | "CANCELLED";

export function initialExecutionPhaseForLegacyStatus(
  status: LegacyCloudGenerationStatus,
): CloudGenerationExecutionPhase {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "unknown";
    case "completed":
      return "succeeded";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
  }
}

export function toResumableCloudGenerationState(input: {
  status: LegacyCloudGenerationStatus;
  executionPhase?: CloudGenerationExecutionPhase | null;
  retryDisposition?: CloudGenerationRetryDisposition | null;
  errorCode?: string | null;
}): ResumableCloudGenerationState {
  if (input.status === "completed") return "SUCCEEDED";
  if (input.status === "canceled") return "CANCELLED";
  if (input.status === "failed")
    return input.retryDisposition === "manual"
      ? "FAILED_RETRYABLE"
      : "FAILED_FINAL";
  if (input.status === "queued")
    return input.retryDisposition === "automatic" || Boolean(input.errorCode)
      ? "FAILED_RETRYABLE"
      : "QUEUED";
  if (input.executionPhase === "preparing") return "PREPARING";
  if (input.executionPhase === "validating") return "VALIDATING";
  return "GENERATING";
}
