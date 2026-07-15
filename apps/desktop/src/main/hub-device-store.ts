import fs from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";
import { z } from "zod";

const storedCredentialSchema = z.object({
  baseUrl: z.string().url(),
  encryptedToken: z.string().min(1),
  userCode: z.string(),
  verificationPath: z.string().startsWith("/"),
  expiresAt: z.string(),
  status: z.enum(["pending", "approved", "denied", "expired", "revoked"]),
  approvedAt: z.string().nullable().optional(),
  tokenExpiresAt: z.string().nullable().optional(),
  scopes: z.array(z.string()).optional(),
});
type StoredCredential = z.infer<typeof storedCredentialSchema>;
export type HubDeviceState = Omit<StoredCredential, "encryptedToken">;

function credentialPath() {
  return path.join(app.getPath("userData"), "hub-device-credential.json");
}

export function saveHubDeviceCredential(
  value: Omit<StoredCredential, "encryptedToken"> & { deviceToken: string },
) {
  if (!safeStorage.isEncryptionAvailable())
    throw new Error("OSの安全な資格情報暗号化を利用できません。");
  const { deviceToken, ...metadata } = value;
  const stored = storedCredentialSchema.parse({
    ...metadata,
    encryptedToken: safeStorage.encryptString(deviceToken).toString("base64"),
  });
  const filePath = credentialPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(stored), {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function readHubDeviceCredential() {
  const filePath = credentialPath();
  if (!fs.existsSync(filePath)) return null;
  if (!safeStorage.isEncryptionAvailable())
    throw new Error("OSの安全な資格情報暗号化を利用できません。");
  try {
    const stored = storedCredentialSchema.parse(
      JSON.parse(fs.readFileSync(filePath, "utf8")),
    );
    return {
      ...stored,
      deviceToken: safeStorage.decryptString(
        Buffer.from(stored.encryptedToken, "base64"),
      ),
    };
  } catch {
    throw new Error("保存済みHub端末認証を読み取れませんでした。");
  }
}

export function hubDeviceState(): HubDeviceState | null {
  const credential = readHubDeviceCredential();
  if (!credential) return null;
  return {
    baseUrl: credential.baseUrl,
    userCode: credential.userCode,
    verificationPath: credential.verificationPath,
    expiresAt: credential.expiresAt,
    status: credential.status,
    approvedAt: credential.approvedAt,
    tokenExpiresAt: credential.tokenExpiresAt,
    scopes: credential.scopes,
  };
}

export function deleteHubDeviceCredential() {
  fs.rmSync(credentialPath(), { force: true });
}
