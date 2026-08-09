import {
  hashRateLimitSubject,
  readRequestClientAddress,
} from "@/lib/rate-limit-primitives";
import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_SECONDS = 60;
const GLOBAL_LIMIT = 600;
const IP_LIMIT = 20;
const UNKNOWN_IP_LIMIT = 5;
const ASSET_UPLOAD_USER_LIMIT = 30;
const ASSET_UPLOAD_IP_LIMIT = 60;
const ASSET_UPLOAD_UNKNOWN_IP_LIMIT = 10;

function subjectKey(value: string) {
  const secret =
    process.env.CLOUD_AI_RATE_LIMIT_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32)
    throw new Error("Cloud AI rate limit秘密値が設定されていません。");
  return hashRateLimitSubject(value, secret);
}

async function consume(
  scope: "global" | "ip" | "user",
  key: string,
  limit: number,
) {
  const { data, error } = await createAdminClient().rpc(
    "consume_cloud_ai_rate_limit",
    {
      p_scope: scope,
      p_subject_key: subjectKey(key),
      p_request_limit: limit,
      p_window_seconds: WINDOW_SECONDS,
    },
  );
  if (error) throw new Error("Cloud AI rate limitを確認できませんでした。");
  return data === true;
}

export async function enforceCloudAssetUploadRateLimit(
  request: Request,
  userId: string,
) {
  if (
    !(await consume(
      "user",
      `cloud-asset-upload:user:${userId}`,
      ASSET_UPLOAD_USER_LIMIT,
    ))
  )
    return { allowed: false as const, retryAfterSeconds: WINDOW_SECONDS };
  const address = readRequestClientAddress(request);
  const allowed = await consume(
    "ip",
    `cloud-asset-upload:ip:${address ?? "unknown"}`,
    address ? ASSET_UPLOAD_IP_LIMIT : ASSET_UPLOAD_UNKNOWN_IP_LIMIT,
  );
  return { allowed, retryAfterSeconds: WINDOW_SECONDS };
}

export async function enforceCloudAiRateLimit(request: Request) {
  if (!(await consume("global", "cloud-ai:global", GLOBAL_LIMIT)))
    return { allowed: false as const, retryAfterSeconds: WINDOW_SECONDS };
  const address = readRequestClientAddress(request);
  const allowed = await consume(
    "ip",
    `cloud-ai:${address ?? "unknown"}`,
    address ? IP_LIMIT : UNKNOWN_IP_LIMIT,
  );
  return { allowed, retryAfterSeconds: WINDOW_SECONDS };
}
