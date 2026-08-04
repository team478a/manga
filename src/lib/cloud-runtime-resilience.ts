import { logHubError } from "./hub-logger.ts";

export type CloudLoadResult<T> =
  | { ok: true; value: T }
  | { ok: false; value: T };

export async function safelyLoadCloudData<T>(
  scope: string,
  load: () => Promise<T>,
  fallback: T,
  options: { shouldRethrow?: (error: unknown) => boolean } = {},
): Promise<CloudLoadResult<T>> {
  try {
    return { ok: true, value: await load() };
  } catch (error) {
    if (options.shouldRethrow?.(error)) throw error;
    logHubError("cloud_data_load_failed", error, { scope });
    return { ok: false, value: fallback };
  }
}
