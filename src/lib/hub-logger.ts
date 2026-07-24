import crypto from "node:crypto";
import { isDomainError } from "./domain-errors.ts";

export type HubLogLevel = "debug" | "info" | "warn" | "error";
export type HubLogContext = Record<string, unknown>;
export type HubRequestContext = {
  requestId: string;
  method: string;
  path: string;
};

type HubLogOptions = {
  minLevel?: HubLogLevel;
  now?: () => Date;
  write?: (line: string, level: HubLogLevel) => void;
};

const LEVEL_WEIGHT: Record<HubLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
const SENSITIVE_KEY =
  /(^|_)(authorization|cookie|password|secret|token|api[_-]?key|service[_-]?role|device[_-]?code|signature)($|_)/i;
const PRIVATE_CREATIVE_KEY =
  /(^|_)(prompt|negative[_-]?prompt|input[_-]?image|mask[_-]?image|image[_-]?bytes|bytes|base64|data[_-]?url|input[_-]?json|output[_-]?json)($|_)/i;
const PERSONAL_KEY =
  /(^|_)(email|display[_-]?name|bio|description|note|title)($|_)/i;
const ERROR_KEY = /(^|_)(error|cause)($|_)/i;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function configuredLevel(): HubLogLevel {
  const value = process.env.MANGAI_HUB_LOG_LEVEL;
  return value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error"
    ? value
    : "info";
}

function sanitizeString(value: string) {
  return value
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_KEY]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_KEY]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED_JWT]",
    )
    .replace(/([?&](?:token|key|secret|code|signature)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[REDACTED_EMAIL]",
    )
    .replace(
      /((?:postgres(?:ql)?|https?):\/\/)[^/\s:@]+:[^@\s/]+@/gi,
      "$1[REDACTED]@",
    )
    .slice(0, 4_000);
}

export function sanitizeHubLogValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (typeof value === "string") return sanitizeString(value);
  if (value === null || typeof value === "number" || typeof value === "boolean")
    return value;
  if (value instanceof Error) return sanitizeHubLogError(value);
  if (Array.isArray(value))
    return value
      .slice(0, 50)
      .map((item) => sanitizeHubLogValue(item, depth + 1));
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([key, item]) => [
          sanitizeString(key).slice(0, 120),
          ERROR_KEY.test(key)
            ? sanitizeHubLogError(item)
            : SENSITIVE_KEY.test(key) ||
          PRIVATE_CREATIVE_KEY.test(key) ||
          PERSONAL_KEY.test(key)
            ? "[REDACTED]"
            : sanitizeHubLogValue(item, depth + 1),
        ]),
    );
  return sanitizeString(String(value));
}

function sanitizeHubLogError(error: unknown) {
  return {
    name:
      error instanceof Error
        ? sanitizeString(error.name).slice(0, 120)
        : "UnknownError",
    code: isDomainError(error) ? error.code : "INTERNAL_ERROR",
  };
}

export function createHubRequestContext(request: Request): HubRequestContext {
  const supplied = request.headers.get("x-request-id")?.trim();
  let path = "/";
  try {
    path = new URL(request.url).pathname;
  } catch {
    // The request path is diagnostic metadata only.
  }
  return {
    requestId:
      supplied && REQUEST_ID.test(supplied) ? supplied : crypto.randomUUID(),
    method: request.method.toUpperCase().slice(0, 12),
    path: sanitizeString(path).slice(0, 500),
  };
}

export function attachHubRequestId<T extends { headers: Headers }>(
  response: T,
  context: HubRequestContext,
) {
  response.headers.set("x-mangai-request-id", context.requestId);
  return response;
}

function defaultWrite(line: string, level: HubLogLevel) {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.info(line);
}

export function logHubEvent(
  level: HubLogLevel,
  event: string,
  context: HubLogContext = {},
  options: HubLogOptions = {},
) {
  const minimum = options.minLevel ?? configuredLevel();
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minimum]) return false;
  try {
    const line = JSON.stringify({
      at: (options.now?.() ?? new Date()).toISOString(),
      level,
      service: "mangai-hub",
      event: sanitizeString(event).slice(0, 120),
      context: sanitizeHubLogValue(context),
    });
    (options.write ?? defaultWrite)(line, level);
    return true;
  } catch {
    return false;
  }
}

export function logHubError(
  event: string,
  error: unknown,
  context: HubLogContext = {},
  options: HubLogOptions = {},
) {
  return logHubEvent(
    "error",
    event,
    { ...context, error: sanitizeHubLogError(error) },
    options,
  );
}
