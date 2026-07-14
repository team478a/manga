import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const DEVICE_PENDING_MINUTES = 15;
export const DEVICE_TOKEN_DAYS = 90;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type DesktopAuthorization = {
  id: string;
  profileId: string;
  scopes: string[];
};

export function hashDeviceSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function generateDeviceSecret() {
  return randomBytes(32).toString("base64url");
}

export function generateUserCode() {
  const bytes = randomBytes(8);
  const code = Array.from(
    bytes,
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length],
  ).join("");
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
  return match?.[1] ?? null;
}

export async function authorizeDesktopRequest(
  request: Request,
): Promise<DesktopAuthorization | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("desktop_device_authorizations")
    .select("id, profile_id, scopes")
    .eq("secret_hash", hashDeviceSecret(token))
    .eq("status", "approved")
    .gt("token_expires_at", now)
    .maybeSingle<{ id: string; profile_id: string; scopes: string[] }>();
  if (error) throw new Error(error.message);
  if (!data?.profile_id || !data.scopes.includes("works:read")) return null;
  await admin
    .from("desktop_device_authorizations")
    .update({ last_used_at: now })
    .eq("id", data.id);
  return { id: data.id, profileId: data.profile_id, scopes: data.scopes };
}
