const INTERNAL_PATH_BASE = "https://app.mang-ai.com";

export function isSafeInternalPath(value: string | null | undefined): value is string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return false;
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;

  try {
    const parsed = new URL(value, INTERNAL_PATH_BASE);
    return parsed.origin === INTERNAL_PATH_BASE && parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
}
