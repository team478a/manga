import { AIProviderError } from "@mangai/ai-core";
import {
  LeaseLostError,
  isDomainError,
} from "../../../lib/domain-errors.ts";
import {
  classifyCloudGenerationFailureStage,
  readSafeHttpStatus,
} from "./generation-lifecycle-event.ts";

export class CloudGenerationLeaseLostError extends LeaseLostError {
  constructor() {
    super("Cloud AI Jobのleaseを失いました。");
    this.name = "CloudGenerationLeaseLostError";
  }
}

export function classifyCloudAiWorkerError(error: unknown) {
  if (error instanceof AIProviderError) {
    const code = error.code;
    return {
      code,
      message: error.message,
      retryable: error.retryable,
      failureStage: classifyCloudGenerationFailureStage(code),
      httpStatus: readSafeHttpStatus(error),
    };
  }
  if (error instanceof Error && error.name === "AbortError")
    return {
      code: "timeout",
      message: "Providerがタイムアウトしました。",
      retryable: true,
      failureStage: "provider" as const,
      httpStatus: readSafeHttpStatus(error),
    };
  if (isDomainError(error)) {
    const code = error.code.toLowerCase();
    return {
      code,
      message: error.message,
      retryable:
        error.code === "PROVIDER_TIMEOUT" ||
        error.code === "PROVIDER_UNAVAILABLE" ||
        error.code === "RATE_LIMITED",
      failureStage: classifyCloudGenerationFailureStage(code),
      httpStatus: readSafeHttpStatus(error),
    };
  }
  return {
    code: "provider_error",
    message:
      error instanceof Error ? error.message : "Provider処理に失敗しました。",
    retryable: false,
    failureStage: "provider" as const,
    httpStatus: readSafeHttpStatus(error),
  };
}
