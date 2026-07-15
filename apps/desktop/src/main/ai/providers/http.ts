import { AIProviderError } from "@mangai/ai-core";
function isLoopback(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized === "[::1]") return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(
    normalized,
  );
  return Boolean(match && match.slice(1).every((part) => +part <= 255) && +match[1] === 127);
}

function normalizeAllowedOrigin(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.pathname && url.pathname !== "/") ||
    url.search ||
    url.hash
  )
    throw new AIProviderError(
      "INVALID_ALLOWED_ORIGIN",
      "許可する接続先はHTTPS origin形式で指定してください。",
    );
  return url.origin.toLowerCase();
}

export function safeBaseUrl(value: string, allowedOrigins: string[] = []) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.pathname && url.pathname !== "/") ||
    url.search ||
    url.hash
  )
    throw new AIProviderError("INVALID_URL", "接続先URLが不正です。");
  if (!isLoopback(url.hostname)) {
    if (url.protocol !== "https:")
      throw new AIProviderError(
        "INSECURE_REMOTE_URL",
        "localhost以外のAI接続先にはHTTPSが必要です。",
      );
    const allowed = new Set(allowedOrigins.map(normalizeAllowedOrigin));
    if (!allowed.has(url.origin.toLowerCase()))
      throw new AIProviderError(
        "ORIGIN_NOT_ALLOWED",
        "AI接続先が許可リストに登録されていません。",
      );
  }
  return url.origin;
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
    return await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
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
