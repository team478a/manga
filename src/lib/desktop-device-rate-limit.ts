import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DomainError,
  ProviderUnavailableError,
} from "@/lib/domain-errors";

const WINDOW_SECONDS = 15 * 60;
const GLOBAL_REQUEST_LIMIT = 300;
const CLIENT_REQUEST_LIMIT = 10;
const UNKNOWN_CLIENT_REQUEST_LIMIT = 50;

function clientAddress(request: Request) {
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

function rateLimitKey(value: string) {
  const secret =
    process.env.DESKTOP_AUTH_RATE_LIMIT_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32)
    throw new ProviderUnavailableError(
      "端末認証rate limit用に32byte以上のサーバー秘密値が必要です。",
    );
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

async function consume(keyHash: string, requestLimit: number) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_desktop_device_rate_limit", {
    p_key_hash: keyHash,
    p_request_limit: requestLimit,
    p_window_seconds: WINDOW_SECONDS,
  });
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "端末認証rate limitを確認できませんでした。",
      { cause: error },
    );
  return data === true;
}

export async function enforceDesktopDeviceRateLimit(request: Request) {
  const globalAllowed = await consume(
    rateLimitKey("desktop-device-authorize:global"),
    GLOBAL_REQUEST_LIMIT,
  );
  if (!globalAllowed)
    return { allowed: false as const, retryAfterSeconds: WINDOW_SECONDS };

  const address = clientAddress(request);
  const clientAllowed = await consume(
    rateLimitKey(`desktop-device-authorize:${address ?? "unknown"}`),
    address ? CLIENT_REQUEST_LIMIT : UNKNOWN_CLIENT_REQUEST_LIMIT,
  );
  return {
    allowed: clientAllowed,
    retryAfterSeconds: WINDOW_SECONDS,
  };
}

export async function cleanupDesktopDeviceAuthorizations() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "cleanup_desktop_device_authorizations",
  );
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "期限切れ端末認証を整理できませんでした。",
      { cause: error },
    );
  return typeof data === "number" ? data : 0;
}
