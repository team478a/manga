import { z } from "zod";

const diagnosticSchema = z.object({
  userAgent: z.string().max(500).optional(),
  language: z.string().max(50).optional(),
  viewport: z.object({ width: z.number().int().min(1).max(10000), height: z.number().int().min(1).max(10000) }).optional(),
  timezone: z.string().max(100).optional(),
  pathname: z.string().max(500).optional(),
  capturedAt: z.string().datetime().optional(),
  online: z.boolean().optional(),
}).strict();

export type MonitorDiagnostic = z.infer<typeof diagnosticSchema>;

export function sanitizeMonitorText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[メールアドレス]")
    .replace(/(?:\+?81[-\s]?)?0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/g, "[電話番号]")
    .replace(/\b(?:sk|sk-proj|xai|dapi|dezgo)[-_][A-Za-z0-9_-]{12,}\b/gi, "[APIキー]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{12,}/gi, "Bearer [認証情報]")
    .replace(/(password|passwd|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[非表示]");
}

export function sanitizeMonitorUrl(value: string) {
  if (!value) return "";
  try {
    const relative = value.startsWith("/");
    const url = relative ? new URL(value, "https://app.mang-ai.com") : new URL(value);
    if (!relative && url.origin !== "https://app.mang-ai.com") return "";
    return `${relative ? "" : url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return "";
  }
}

export function parseMonitorDiagnostic(value: FormDataEntryValue | null): MonitorDiagnostic {
  if (typeof value !== "string" || !value || value.length > 10_000) return {};
  try {
    return diagnosticSchema.parse(JSON.parse(value));
  } catch {
    return {};
  }
}

const allowedScreenshotTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export const MAX_MONITOR_SCREENSHOTS = 5;
export const MAX_MONITOR_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const MAX_MONITOR_SCREENSHOTS_TOTAL_BYTES = 20 * 1024 * 1024;

export type MonitorScreenshot = {
  file: File;
  extension: string;
};

export function validateMonitorScreenshot(
  value: FormDataEntryValue | null,
): MonitorScreenshot | null {
  if (!(value instanceof File) || value.size === 0) return null;
  const extension = allowedScreenshotTypes.get(value.type);
  if (!extension || value.size > MAX_MONITOR_SCREENSHOT_BYTES)
    throw new Error("monitor_screenshot_invalid");
  return { file: value, extension };
}

export function validateMonitorScreenshots(
  values: FormDataEntryValue[],
): MonitorScreenshot[] {
  const screenshots = values
    .map(validateMonitorScreenshot)
    .filter((item): item is MonitorScreenshot => item !== null);
  if (
    screenshots.length > MAX_MONITOR_SCREENSHOTS ||
    screenshots.reduce((sum, item) => sum + item.file.size, 0) >
      MAX_MONITOR_SCREENSHOTS_TOTAL_BYTES
  )
    throw new Error("monitor_screenshots_invalid");
  return screenshots;
}
