import type { DomainErrorCode } from "./domain-errors";

export type ApiErrorEnvelope = {
  error: string;
  errorCode: DomainErrorCode;
};

export type CompatibleApiErrorEnvelope = {
  error?: string | { code?: string; message?: string };
  errorCode?: string;
};

export function readApiErrorMessage(
  value: CompatibleApiErrorEnvelope,
  fallbackMessage: string,
) {
  if (typeof value.error === "string") return value.error;
  if (
    typeof value.error === "object" &&
    value.error &&
    typeof value.error.message === "string"
  )
    return value.error.message;
  return fallbackMessage;
}

export function readApiErrorCode(value: CompatibleApiErrorEnvelope) {
  if (typeof value.errorCode === "string") return value.errorCode;
  if (
    typeof value.error === "object" &&
    value.error &&
    typeof value.error.code === "string"
  )
    return value.error.code;
  return undefined;
}
