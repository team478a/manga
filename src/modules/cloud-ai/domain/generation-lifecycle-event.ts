import type {
  CloudGenerationExecutionPhase,
  CloudGenerationRetryDisposition,
} from "./resumable-generation-state.ts";

export type CloudGenerationFailureStage =
  | "request"
  | "visual_readiness"
  | "moderation"
  | "quota"
  | "claim"
  | "lease"
  | "reference_resolution"
  | "provider"
  | "validation"
  | "storage"
  | "completion"
  | "quality"
  | "adoption"
  | "dialogue";

export type CloudGenerationLifecycleEventType =
  | "phase_changed"
  | "retry_scheduled"
  | "lease_reclaimed"
  | "canceled"
  | "completed"
  | "failed";

export function buildCloudGenerationLifecycleMutation(input: {
  executionPhase: CloudGenerationExecutionPhase;
  eventType: CloudGenerationLifecycleEventType;
  attemptNumber: number;
  failureStage?: CloudGenerationFailureStage | null;
  retryDisposition?: CloudGenerationRetryDisposition | null;
  httpStatus?: number | null;
  occurredAt: string;
}) {
  const httpStatus =
    Number.isInteger(input.httpStatus) &&
    Number(input.httpStatus) >= 100 &&
    Number(input.httpStatus) <= 599
      ? Number(input.httpStatus)
      : null;
  return {
    jobUpdate: {
      execution_phase: input.executionPhase,
      failure_stage: input.failureStage ?? null,
      retry_disposition: input.retryDisposition ?? null,
      http_status: httpStatus,
      last_checkpoint_at: input.occurredAt,
      updated_at: input.occurredAt,
    },
    event: {
      execution_phase: input.executionPhase,
      event_type: input.eventType,
      attempt_number: Math.max(0, Math.min(100, input.attemptNumber)),
      metadata: {},
      created_at: input.occurredAt,
    },
  };
}

export function classifyCloudGenerationFailureStage(code: string) {
  if (code === "timeout" || code.startsWith("provider_")) return "provider" as const;
  if (code.includes("lease")) return "lease" as const;
  if (code.includes("storage")) return "storage" as const;
  if (code.includes("reference") || code.includes("asset"))
    return "reference_resolution" as const;
  if (code.includes("validation") || code.includes("invalid"))
    return "validation" as const;
  return "provider" as const;
}

export function readSafeHttpStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  for (const value of [candidate.status, candidate.statusCode])
    if (Number.isInteger(value) && Number(value) >= 100 && Number(value) <= 599)
      return Number(value);
  return null;
}
