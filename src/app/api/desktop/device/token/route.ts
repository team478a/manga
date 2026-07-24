import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerToken, hashDeviceSecret } from "@/lib/desktop-auth";
import { toMessageApiError } from "@/lib/api-errors";
import {
  AuthenticationRequiredError,
  ProviderUnavailableError,
} from "@/lib/domain-errors";
import {
  attachHubRequestId,
  createHubRequestContext,
  logHubError,
  logHubEvent,
} from "@/lib/hub-logger";

export async function GET(request: Request) {
  const logContext = createHubRequestContext(request);
  const token = bearerToken(request);
  try {
    if (!token)
      throw new AuthenticationRequiredError("端末トークンが不正です。");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("desktop_device_authorizations")
      .select("id, status, expires_at, token_expires_at, approved_at, scopes")
      .eq("secret_hash", hashDeviceSecret(token))
      .maybeSingle<{
        id: string;
        status: "pending" | "approved" | "denied" | "expired" | "revoked";
        expires_at: string;
        token_expires_at: string | null;
        approved_at: string | null;
        scopes: string[];
      }>();
    if (error)
      throw new ProviderUnavailableError(
        "端末認証を確認できませんでした。",
      );
    if (!data)
      throw new AuthenticationRequiredError("端末認証が見つかりません。");
    if (
      data.status === "pending" &&
      new Date(data.expires_at).getTime() <= Date.now()
    ) {
      await admin
        .from("desktop_device_authorizations")
        .update({ status: "expired" })
        .eq("id", data.id);
      return NextResponse.json({ status: "expired" }, { status: 410 });
    }
    if (data.status === "approved")
      return NextResponse.json({
        status: "approved",
        approvedAt: data.approved_at,
        tokenExpiresAt: data.token_expires_at,
        scopes: data.scopes,
      });
    return NextResponse.json(
      { status: data.status },
      { status: data.status === "pending" ? 202 : 410 },
    );
  } catch (cause) {
    logHubError(
      "desktop_device_authorization_poll_failed",
      cause,
      logContext,
    );
    const response = toMessageApiError(
      cause,
      "端末認証を確認できませんでした。",
    );
    return attachHubRequestId(
      NextResponse.json(response.body, { status: response.status }),
      logContext,
    );
  }
}

export async function DELETE(request: Request) {
  const logContext = createHubRequestContext(request);
  const token = bearerToken(request);
  try {
    if (!token)
      throw new AuthenticationRequiredError("端末トークンが不正です。");
    const admin = createAdminClient();
    const { error } = await admin
      .from("desktop_device_authorizations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("secret_hash", hashDeviceSecret(token));
    if (error)
      throw new ProviderUnavailableError(
        "端末認証を解除できませんでした。",
      );
    logHubEvent("info", "desktop_device_authorization_revoked", logContext);
    return attachHubRequestId(
      NextResponse.json({ revoked: true }),
      logContext,
    );
  } catch (cause) {
    logHubError(
      "desktop_device_authorization_revoke_failed",
      cause,
      logContext,
    );
    const response = toMessageApiError(
      cause,
      "端末認証を解除できませんでした。",
    );
    return attachHubRequestId(
      NextResponse.json(response.body, { status: response.status }),
      logContext,
    );
  }
}
