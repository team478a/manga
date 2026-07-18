import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const SENSITIVE_KEY =
  /(^|_)(authorization|cookie|password|secret|token|api[_-]?key|device[_-]?code)($|_)/i;
const PRIVATE_CREATIVE_KEY =
  /(^|_)(prompt|negative[_-]?prompt|input[_-]?image|mask[_-]?image|image[_-]?bytes|bytes|base64|data[_-]?url|input[_-]?json|output[_-]?json)($|_)/i;

function sanitizeString(value: string) {
  const home = os.homedir();
  return value
    .replaceAll(home, "~")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_KEY]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED_JWT]",
    )
    .replace(/([?&](?:token|key|secret|code)=)[^&\s]+/gi, "$1[REDACTED]")
    .slice(0, 8_000);
}

export function sanitizeDiagnosticValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (typeof value === "string") return sanitizeString(value);
  if (value === null || typeof value === "number" || typeof value === "boolean")
    return value;
  if (value instanceof Error)
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  if (Array.isArray(value))
    return value
      .slice(0, 50)
      .map((item) => sanitizeDiagnosticValue(item, depth + 1));
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          SENSITIVE_KEY.test(key) || PRIVATE_CREATIVE_KEY.test(key)
            ? "[REDACTED]"
            : sanitizeDiagnosticValue(item, depth + 1),
        ]),
    );
  return sanitizeString(String(value));
}

export class StructuredLogger {
  readonly filePath: string;

  constructor(
    logsDirectory: string,
    private readonly options: {
      maxBytes?: number;
      retainedFiles?: number;
      now?: () => Date;
    } = {},
  ) {
    this.filePath = path.join(logsDirectory, "desktop.jsonl");
  }

  private rotate(nextBytes: number) {
    const maxBytes = this.options.maxBytes ?? 5 * 1024 * 1024;
    const retainedFiles = this.options.retainedFiles ?? 3;
    if (!fs.existsSync(this.filePath)) return;
    if (fs.statSync(this.filePath).size + nextBytes <= maxBytes) return;
    for (let index = retainedFiles; index >= 1; index -= 1) {
      const source =
        index === 1 ? this.filePath : `${this.filePath}.${index - 1}`;
      const target = `${this.filePath}.${index}`;
      if (!fs.existsSync(source)) continue;
      fs.rmSync(target, { force: true });
      fs.renameSync(source, target);
    }
  }

  log(level: LogLevel, event: string, context: LogContext = {}) {
    const entry = `${JSON.stringify({
      at: (this.options.now?.() ?? new Date()).toISOString(),
      level,
      event: sanitizeString(event).slice(0, 120),
      context: sanitizeDiagnosticValue(context),
    })}\n`;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      this.rotate(Buffer.byteLength(entry));
      fs.appendFileSync(this.filePath, entry, "utf8");
    } catch (cause) {
      console.error("Structured log write failed", cause);
    }
  }
}
