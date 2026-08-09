import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export function readRequestClientAddress(request: Request) {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    ...(request.headers.get("x-forwarded-for")?.split(",") ?? []),
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && isIP(value)) return value;
  }
  return null;
}

export function hashRateLimitSubject(value: string, secret: string) {
  return createHmac("sha256", secret)
    .update(value, "utf8")
    .digest("hex");
}
