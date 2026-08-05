import { AIProviderError } from "@mangai/ai-core";
import {
  LeaseLostError,
  isDomainError,
} from "../../../lib/domain-errors.ts";

export class CloudGenerationLeaseLostError extends LeaseLostError {
  constructor() {
    super("Cloud AI Jobのleaseを失いました。");
    this.name = "CloudGenerationLeaseLostError";
  }
}

export function classifyCloudAiWorkerError(error: unknown) {
  if (error instanceof AIProviderError)
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  if (error instanceof Error && error.name === "AbortError")
    return {
      code: "timeout",
      message: "Providerがタイムアウトしました。",
      retryable: true,
    };
  if (isDomainError(error))
    return {
      code: error.code.toLowerCase(),
      message: error.message,
      retryable:
        error.code === "PROVIDER_TIMEOUT" ||
        error.code === "PROVIDER_UNAVAILABLE" ||
        error.code === "RATE_LIMITED",
    };
  return {
    code: "provider_error",
    message:
      error instanceof Error ? error.message : "Provider処理に失敗しました。",
    retryable: false,
  };
}
