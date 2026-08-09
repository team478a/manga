import { createAdminClient } from "@/lib/supabase/admin";

export type DesktopDevicePollRecord = {
  id: string;
  status: "pending" | "approved" | "denied" | "expired" | "revoked";
  expires_at: string;
  token_expires_at: string | null;
  approved_at: string | null;
  scopes: string[];
};

export type PendingDesktopDeviceAuthorization = {
  id: string;
  expires_at: string;
  scopes: string[];
};

export type ApprovedDesktopDevice = {
  id: string;
  device_name: string;
  approved_at: string | null;
  last_used_at: string | null;
  token_expires_at: string | null;
};

export function createDesktopDeviceRepository() {
  const admin = createAdminClient();

  return {
    insertPendingAuthorization(input: {
      deviceName: string;
      secretHash: string;
      userCode: string;
      expiresAt: string;
      scopes: string[];
    }) {
      return admin.from("desktop_device_authorizations").insert({
        device_name: input.deviceName,
        secret_hash: input.secretHash,
        user_code: input.userCode,
        status: "pending",
        expires_at: input.expiresAt,
        scopes: input.scopes,
      });
    },

    findBySecretHash(secretHash: string) {
      return admin
        .from("desktop_device_authorizations")
        .select("id, status, expires_at, token_expires_at, approved_at, scopes")
        .eq("secret_hash", secretHash)
        .maybeSingle<DesktopDevicePollRecord>();
    },

    expireAuthorization(id: string) {
      return admin
        .from("desktop_device_authorizations")
        .update({ status: "expired" })
        .eq("id", id);
    },

    revokeBySecretHash(secretHash: string, revokedAt: string) {
      return admin
        .from("desktop_device_authorizations")
        .update({ status: "revoked", revoked_at: revokedAt })
        .eq("secret_hash", secretHash);
    },

    findPendingByUserCode(userCode: string) {
      return admin
        .from("desktop_device_authorizations")
        .select("id, expires_at, scopes")
        .eq("user_code", userCode)
        .eq("status", "pending")
        .maybeSingle<PendingDesktopDeviceAuthorization>();
    },

    approvePendingAuthorization(input: {
      id: string;
      profileId: string;
      approvedAt: string;
      tokenExpiresAt: string;
    }) {
      return admin
        .from("desktop_device_authorizations")
        .update({
          profile_id: input.profileId,
          status: "approved",
          approved_at: input.approvedAt,
          token_expires_at: input.tokenExpiresAt,
        })
        .eq("id", input.id)
        .eq("status", "pending")
        .gt("expires_at", input.approvedAt)
        .select("id")
        .maybeSingle<{ id: string }>();
    },

    revokeApprovedAuthorization(input: {
      id: string;
      profileId: string;
      revokedAt: string;
    }) {
      return admin
        .from("desktop_device_authorizations")
        .update({ status: "revoked", revoked_at: input.revokedAt })
        .eq("id", input.id)
        .eq("profile_id", input.profileId)
        .eq("status", "approved");
    },

    findPendingScopesByUserCode(userCode: string) {
      return admin
        .from("desktop_device_authorizations")
        .select("scopes")
        .eq("user_code", userCode)
        .eq("status", "pending")
        .maybeSingle<{ scopes: string[] }>();
    },

    listApprovedForProfile(profileId: string) {
      return admin
        .from("desktop_device_authorizations")
        .select("id, device_name, approved_at, last_used_at, token_expires_at")
        .eq("profile_id", profileId)
        .eq("status", "approved")
        .order("approved_at", { ascending: false })
        .returns<ApprovedDesktopDevice[]>();
    },
  };
}
