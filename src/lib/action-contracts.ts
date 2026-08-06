import { z } from "zod";

export const actionIdSchema = z.string().uuid();

export type ActionFeedbackKind = "message" | "error";

export function actionFeedbackTarget(
  destination: string,
  kind: ActionFeedbackKind,
  message: string,
) {
  return `${destination}?${kind}=${encodeURIComponent(message)}`;
}

export function allowedInternalRedirect(
  candidate: string | null,
  allowedPaths: readonly string[],
  fallback: string,
) {
  return candidate !== null && allowedPaths.includes(candidate)
    ? candidate
    : fallback;
}

