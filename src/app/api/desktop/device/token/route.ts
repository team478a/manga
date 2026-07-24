import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerToken, hashDeviceSecret } from "@/lib/desktop-auth";
import { toMessageApiError } from "@/lib/api-errors";
import {
  AuthenticationRequiredError,
  ProviderUnavailableError,
} from "@/lib/domain-errors";

export async function GET(request: Request) {
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
    console.error("Desktop device authorization poll failed", cause);
    const response = toMessageApiError(
      cause,
      "端末認証を確認できませんでした。",
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE(request: Request) {
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
    return NextResponse.json({ revoked: true });
  } catch (cause) {
    console.error("Desktop device authorization revoke failed", cause);
    const response = toMessageApiError(
      cause,
      "端末認証を解除できませんでした。",
    );
    return NextResponse.json(response.body, { status: response.status });
  }
}
