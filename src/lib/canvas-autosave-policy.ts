export const CANVAS_SAVE_TIMEOUT_MS = 10_000;
export const CANVAS_SAVE_RETRY_MAX_MS = 30_000;

export function canvasSaveRetryDelay(attempt: number) {
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(
    CANVAS_SAVE_RETRY_MAX_MS,
    1_000 * 2 ** Math.min(normalizedAttempt - 1, 10),
  );
}

export function shouldRetryCanvasSave(status?: number) {
  return (
    status === undefined ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

export function hasUnsavedCanvasChanges(state: string) {
  return (
    state === "dirty" ||
    state === "saving" ||
    state === "error" ||
    state === "conflict"
  );
}
