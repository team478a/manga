import { safeDomainErrorMessage } from "../../../lib/api-errors.ts";

export function researchActionError(error: unknown, fallback: string) {
  return safeDomainErrorMessage(error, fallback);
}
