import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEVICE_PENDING_MINUTES,
  generateDeviceSecret,
  generateUserCode,
  hashDeviceSecret,
  DESKTOP_DRAFT_WRITE_SCOPE,
  DESKTOP_READ_SCOPE,
} from "@/lib/desktop-auth";
import {
  cleanupDesktopDeviceAuthorizations,
  enforceDesktopDeviceRateLimit,
} from "@/lib/desktop-device-rate-limit";
import { toMessageApiError } from "@/lib/api-errors";
import {
  ProviderUnavailableError,
  RateLimitedError,
  ValidationError,
} from "@/lib/domain-errors";
import {
  attachHubRequestId,
  createHubRequestContext,
  logHubError,
  logHubEvent,
} from "@/lib/hub-logger";

const requestSchema = z.object({
  deviceName: z.string().trim().min(1).max(100),
  scopes: z
    .array(z.enum([DESKTOP_READ_SCOPE, DESKTOP_DRAFT_WRITE_SCOPE]))
    .min(1)
    .max(2)
    .default([DESKTOP_READ_SCOPE]),
});

export async function POST(request: Request) {
  const logContext = createHubRequestContext(request);
  try {
    const rateLimit = await enforceDesktopDeviceRateLimit(request);
    if (!rateLimit.allowed) {
      const error = new RateLimitedError(
        "端末認証の開始回数が上限に達しました。15分後に再試行してください。",
      );
      const response = toMessageApiError(error, "端末認証を開始できませんでした。");
      return attachHubRequestId(
        NextResponse.json(response.body, {
          status: response.status,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }),
        logContext,
      );
    }
    await cleanupDesktopDeviceAuthorizations().catch((cause) => {
      logHubEvent("warn", "desktop_device_authorization_cleanup_failed", {
        ...logContext,
        error: cause,
      });
    });
    const parsed = requestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      throw new ValidationError("端末名が不正です。");
    const admin = createAdminClient();
    const deviceToken = generateDeviceSecret();
    const expiresAt = new Date(
      Date.now() + DEVICE_PENDING_MINUTES * 60_000,
    ).toISOString();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const userCode = generateUserCode();
      const { error } = await admin
        .from("desktop_device_authorizations")
        .insert({
          device_name: parsed.data.deviceName,
          secret_hash: hashDeviceSecret(deviceToken),
          user_code: userCode,
          status: "pending",
          expires_at: expiresAt,
          scopes: [...new Set(parsed.data.scopes)],
        });
      if (!error) {
        logHubEvent("info", "desktop_device_authorization_started", {
          ...logContext,
          expiresAt,
          scopes: [...new Set(parsed.data.scopes)],
        });
        return attachHubRequestId(
          NextResponse.json(
            {
              status: "pending",
              deviceToken,
              userCode,
              verificationPath: `/dashboard/devices/authorize?code=${encodeURIComponent(userCode)}`,
              expiresAt,
              intervalSeconds: 5,
            },
            { status: 201 },
          ),
          logContext,
        );
      }
      if (error.code !== "23505")
        throw new ProviderUnavailableError(
          "端末認証を開始できませんでした。",
        );
    }
    throw new ProviderUnavailableError("認証コードを作成できませんでした。");
  } catch (cause) {
    logHubError(
      "desktop_device_authorization_start_failed",
      cause,
      logContext,
    );
    const response = toMessageApiError(
      cause,
      "端末認証を開始できませんでした。",
    );
    return attachHubRequestId(
      NextResponse.json(response.body, { status: response.status }),
      logContext,
    );
  }
}
