import { ZodError } from "zod";
import {
  DomainError,
  type DomainErrorCode,
  isDomainError,
} from "./domain-errors.ts";
import type { ApiErrorEnvelope } from "./api-error-contract";

const domainErrorStatuses: Record<DomainErrorCode, number> = {
  AUTHENTICATION_REQUIRED: 401,
  PERMISSION_DENIED: 403,
  RESOURCE_NOT_FOUND: 404,
  REVISION_CONFLICT: 409,
  QUOTA_EXCEEDED: 429,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 400,
  CONTENT_REJECTED: 422,
  STORAGE_TRANSACTION_ERROR: 500,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_TIMEOUT: 504,
  LEASE_LOST: 409,
  INTERNAL_ERROR: 500,
};

export function toApiError(
  error: unknown,
  fallbackMessage: string,
): { body: ApiErrorEnvelope; status: number } {
  const normalized = isDomainError(error)
    ? error
    : error instanceof ZodError || error instanceof SyntaxError
      ? new DomainError("VALIDATION_ERROR", "入力内容が不正です。", {
          cause: error,
        })
      : new DomainError("INTERNAL_ERROR", fallbackMessage, { cause: error });
  return {
    body: {
      error: normalized.message,
      errorCode: normalized.code,
    },
    status: domainErrorStatuses[normalized.code],
  };
}
