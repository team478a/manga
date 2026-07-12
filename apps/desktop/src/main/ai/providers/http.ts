import { AIProviderError } from "@mangai/ai-core";
export function safeBaseUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new AIProviderError("INVALID_URL", "接続先URLが不正です。");
  return url.toString().replace(/\/$/, "");
}
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  external?: AbortSignal,
) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  const abort = () => controller.abort();
  external?.addEventListener("abort", abort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted)
      throw new AIProviderError(
        "TIMEOUT",
        "AI処理がタイムアウトまたはキャンセルされました。",
        true,
      );
    throw new AIProviderError(
      "CONNECTION_FAILED",
      `AIサービスへ接続できません: ${error instanceof Error ? error.message : "不明なエラー"}`,
      true,
    );
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", abort);
  }
}
