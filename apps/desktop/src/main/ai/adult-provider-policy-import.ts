import crypto from "node:crypto";
import fs from "node:fs";
import { z } from "zod";
import {
  adultModelApprovalInputSchema,
  adultProviderApprovalInputSchema,
} from "@mangai/ai-core";

const maxPolicyBytes = 1024 * 1024;
const maxPolicyLifetimeMs = 180 * 24 * 60 * 60 * 1000;
const clockSkewMs = 5 * 60 * 1000;

const trustedKeySchema = z.object({
  keyId: z.string().regex(/^[a-zA-Z0-9._-]{1,100}$/),
  algorithm: z.literal("ed25519"),
  publicKeyPem: z.string().min(80).max(10_000),
}).strict();
export type AdultProviderPolicyTrustedKey = z.infer<typeof trustedKeySchema>;

const trustConfigSchema = z
  .object({
    keys: z.array(trustedKeySchema).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.keys.map((key) => key.keyId)).size !== value.keys.length)
      context.addIssue({
        code: "custom",
        path: ["keys"],
        message: "成人向け運用policyの信頼鍵IDが重複しています。",
      });
  });

export const adultProviderPolicyPayloadSchema = z
  .object({
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    providerApproval: adultProviderApprovalInputSchema,
    models: z.array(adultModelApprovalInputSchema).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    const issuedMs = Date.parse(value.issuedAt);
    const expiresMs = Date.parse(value.expiresAt);
    if (expiresMs <= issuedMs || expiresMs - issuedMs > maxPolicyLifetimeMs)
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "運用policyの有効期間が不正です。",
      });
    if (new Set(value.models.map((model) => model.modelId)).size !== value.models.length)
      context.addIssue({
        code: "custom",
        path: ["models"],
        message: "運用policyのモデルIDが重複しています。",
      });
    if (
      value.providerApproval.status === "approved" &&
      (!value.providerApproval.expiresAt ||
        Date.parse(value.providerApproval.expiresAt) > expiresMs)
    )
      context.addIssue({
        code: "custom",
        path: ["providerApproval", "expiresAt"],
        message: "Provider承認期限は運用policy期限以内である必要があります。",
      });
    value.models.forEach((model, index) => {
      if (
        model.status === "approved" &&
        (!model.expiresAt || Date.parse(model.expiresAt) > expiresMs)
      )
        context.addIssue({
          code: "custom",
          path: ["models", index, "expiresAt"],
          message: "モデル承認期限は運用policy期限以内である必要があります。",
        });
    });
  });
export type AdultProviderPolicyPayload = z.infer<
  typeof adultProviderPolicyPayloadSchema
>;
export type VerifiedAdultProviderPolicyBundle = {
  keyId: string;
  payloadSha256: string;
  payload: AdultProviderPolicyPayload;
};

const signedBundleSchema = z.object({
  format: z.literal("mangai.adult-provider-policy"),
  version: z.literal(1),
  keyId: z.string().regex(/^[a-zA-Z0-9._-]{1,100}$/),
  payload: adultProviderPolicyPayloadSchema,
  signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/),
}).strict();

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("署名対象に不正な数値があります。");
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error("署名対象に未対応の値があります。");
}

export function adultProviderPolicySigningBytes(input: {
  format: "mangai.adult-provider-policy";
  version: 1;
  keyId: string;
  payload: AdultProviderPolicyPayload;
}) {
  return Buffer.from(canonicalJson(input), "utf8");
}

export function loadAdultProviderPolicyTrustConfig(filePath: string) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size > maxPolicyBytes)
    throw new Error("成人向け運用policyの信頼鍵設定が不正です。");
  return trustConfigSchema.parse(JSON.parse(fs.readFileSync(filePath, "utf8"))).keys;
}

export function readAndVerifyAdultProviderPolicyBundle(
  filePath: string,
  trustedKeys: AdultProviderPolicyTrustedKey[],
  referenceTime = new Date().toISOString(),
): VerifiedAdultProviderPolicyBundle {
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size <= 0 || stat.size > maxPolicyBytes)
    throw new Error("成人向け運用policyファイルのサイズが不正です。");
  const bundle = signedBundleSchema.parse(
    JSON.parse(fs.readFileSync(filePath, "utf8")),
  );
  const referenceMs = Date.parse(referenceTime);
  if (!Number.isFinite(referenceMs))
    throw new Error("成人向け運用policyの基準日時が不正です。");
  const issuedMs = Date.parse(bundle.payload.issuedAt);
  const expiresMs = Date.parse(bundle.payload.expiresAt);
  if (issuedMs > referenceMs + clockSkewMs)
    throw new Error("成人向け運用policyの発行日時が未来です。");
  if (expiresMs <= referenceMs)
    throw new Error("成人向け運用policyの有効期限が切れています。");
  const trustedKey = trustedKeys.find((key) => key.keyId === bundle.keyId);
  if (!trustedKey)
    throw new Error("成人向け運用policyの署名鍵を信頼できません。");
  const publicKey = crypto.createPublicKey(trustedKey.publicKeyPem);
  if (publicKey.asymmetricKeyType !== "ed25519")
    throw new Error("成人向け運用policyの署名鍵形式が不正です。");
  const signature = Buffer.from(bundle.signature, "base64");
  const verified = crypto.verify(
    null,
    adultProviderPolicySigningBytes({
      format: bundle.format,
      version: bundle.version,
      keyId: bundle.keyId,
      payload: bundle.payload,
    }),
    publicKey,
    signature,
  );
  if (!verified) throw new Error("成人向け運用policyの署名が一致しません。");
  return {
    keyId: bundle.keyId,
    payloadSha256: crypto
      .createHash("sha256")
      .update(canonicalJson(bundle.payload), "utf8")
      .digest("hex"),
    payload: bundle.payload,
  };
}
