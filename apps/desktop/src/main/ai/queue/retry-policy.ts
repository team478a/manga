import { AIProviderError } from "@mangai/ai-core";

export const DEZGO_QUEUE_POLICY = Object.freeze({
  maxConcurrentJobs: 1,
  maxActiveJobs: 20,
  maxAttempts: 2,
});

export type DezgoFailureDisposition = "retry" | "hold" | "fail";

const automaticRetryCodes = new Set([
  "DEZGO_RATE_LIMITED",
  "DEZGO_SERVICE_ERROR",
]);

export function dezgoFailureDisposition(
  error: unknown,
  attemptCount: number,
): DezgoFailureDisposition {
  if (!(error instanceof AIProviderError)) return "fail";
  if (error.code === "DEZGO_CONNECTION_FAILED") return "hold";
  if (
    error.retryable &&
    automaticRetryCodes.has(error.code) &&
    attemptCount < DEZGO_QUEUE_POLICY.maxAttempts
  )
    return "retry";
  return "fail";
}

export function generationRetryDelayMs(
  baseDelayMs: number,
  attemptCount: number,
  maximumDelayMs = 30_000,
) {
  return Math.min(
    maximumDelayMs,
    Math.max(10, baseDelayMs) * 2 ** Math.max(0, attemptCount - 1),
  );
}
