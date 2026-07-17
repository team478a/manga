import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  adultProviderPolicySigningBytes,
  loadAdultProviderPolicyTrustConfig,
  readAndVerifyAdultProviderPolicyBundle,
} from "../dist-main/main/ai/adult-provider-policy-import.js";

test("signed adult provider policy rejects tampering, expiry and unknown keys", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-policy-signature-"));
  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
    const payload = {
      issuedAt: "2026-07-17T00:00:00.000Z",
      expiresAt: "2026-08-17T00:00:00.000Z",
      providerApproval: {
        providerId: "dezgo",
        status: "approved",
        evidenceSha256: "a".repeat(64),
        confirmedAt: "2026-07-17T00:00:00.000Z",
        expiresAt: "2026-08-17T00:00:00.000Z",
        revokedAt: null,
      },
      models: [
        {
          providerId: "dezgo",
          modelId: "verified-model",
          status: "approved",
          licenseEvidenceSha256: "b".repeat(64),
          verifiedAt: "2026-07-17T00:00:00.000Z",
          expiresAt: "2026-08-17T00:00:00.000Z",
        },
      ],
    };
    const signed = {
      format: "mangai.adult-provider-policy",
      version: 1,
      keyId: "test-key-1",
      payload,
    };
    const bundle = {
      ...signed,
      signature: crypto
        .sign(null, adultProviderPolicySigningBytes(signed), privateKey)
        .toString("base64"),
    };
    const bundlePath = path.join(root, "policy.json");
    const trustPath = path.join(root, "trust.json");
    fs.writeFileSync(bundlePath, JSON.stringify(bundle));
    fs.writeFileSync(
      trustPath,
      JSON.stringify({
        keys: [{ keyId: "test-key-1", algorithm: "ed25519", publicKeyPem }],
      }),
    );
    const trustedKeys = loadAdultProviderPolicyTrustConfig(trustPath);
    const verified = readAndVerifyAdultProviderPolicyBundle(
      bundlePath,
      trustedKeys,
      "2026-07-18T00:00:00.000Z",
    );
    assert.equal(verified.keyId, "test-key-1");
    assert.equal(verified.payload.models[0].modelId, "verified-model");
    assert.match(verified.payloadSha256, /^[0-9a-f]{64}$/);

    fs.writeFileSync(
      trustPath,
      JSON.stringify({
        keys: [
          { keyId: "test-key-1", algorithm: "ed25519", publicKeyPem },
          { keyId: "test-key-1", algorithm: "ed25519", publicKeyPem },
        ],
      }),
    );
    assert.throws(() => loadAdultProviderPolicyTrustConfig(trustPath));

    fs.writeFileSync(
      bundlePath,
      JSON.stringify({
        ...bundle,
        payload: {
          ...payload,
          models: [{ ...payload.models[0], modelId: "tampered-model" }],
        },
      }),
    );
    assert.throws(() =>
      readAndVerifyAdultProviderPolicyBundle(
        bundlePath,
        trustedKeys,
        "2026-07-18T00:00:00.000Z",
      ),
    );
    fs.writeFileSync(bundlePath, JSON.stringify(bundle));
    const { publicKey: rsaPublicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    assert.throws(() =>
      readAndVerifyAdultProviderPolicyBundle(
        bundlePath,
        [
          {
            keyId: "test-key-1",
            algorithm: "ed25519",
            publicKeyPem: rsaPublicKey.export({ type: "spki", format: "pem" }),
          },
        ],
        "2026-07-18T00:00:00.000Z",
      ),
    );
    assert.throws(() =>
      readAndVerifyAdultProviderPolicyBundle(
        bundlePath,
        [],
        "2026-07-18T00:00:00.000Z",
      ),
    );
    assert.throws(() =>
      readAndVerifyAdultProviderPolicyBundle(
        bundlePath,
        trustedKeys,
        "2026-09-01T00:00:00.000Z",
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
