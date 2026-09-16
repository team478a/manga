import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createStage0ArtifactEvidence } from "../scripts/create-adult-pilot-stage0-artifact-evidence.mjs";

const thumbprint = "abcdef0123456789abcdef0123456789abcdef01";
const fixture = (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-stage0-artifact-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ version: "0.1.0" }),
  );
  const release = path.join(root, "release");
  fs.mkdirSync(release);
  const names = [
    "MANGAI-Desktop-Setup-0.1.0-x64.exe",
    "MANGAI-Desktop-Setup-0.1.0-x64.exe.blockmap",
    "latest.yml",
    "MANGAI-Desktop-0.1.0-sbom.spdx.json",
    "SHA256SUMS.txt",
  ];
  for (const name of names) fs.writeFileSync(path.join(release, name), name);
  const productExecutablePath = path.join(root, "MANGAI Desktop.exe");
  fs.writeFileSync(productExecutablePath, "product executable");
  return {
    root,
    productExecutablePath,
    outputPath: path.join(root, "evidence.json"),
  };
};

test("Stage 0 artifact evidence records only signatures and digests", (t) => {
  const values = fixture(t);
  const evidence = createStage0ArtifactEvidence({
    desktopRoot: values.root,
    directoryName: "release",
    productExecutablePath: values.productExecutablePath,
    outputPath: values.outputPath,
    now: new Date("2026-09-16T00:00:00.000Z"),
    verifyRelease: () => {},
    signatureProbe: () => ({ status: "Valid", thumbprint }),
  });
  assert.equal(evidence.distributionAuthorized, false);
  assert.equal(evidence.signatures.sameSigner, true);
  assert.equal(Object.keys(evidence.artifacts).length, 6);
  for (const digest of Object.values(evidence.artifacts))
    assert.match(digest, /^[a-f0-9]{64}$/);
  const serialized = fs.readFileSync(values.outputPath, "utf8");
  assert.doesNotMatch(
    serialized,
    new RegExp(values.root.replaceAll("\\", "\\\\")),
  );
  assert.doesNotMatch(serialized, new RegExp(thumbprint, "i"));
});

test("Stage 0 artifact evidence refuses overwrite and signer mismatch", (t) => {
  const values = fixture(t);
  const options = {
    desktopRoot: values.root,
    directoryName: "release",
    productExecutablePath: values.productExecutablePath,
    outputPath: values.outputPath,
    verifyRelease: () => {},
    signatureProbe: () => ({ status: "Valid", thumbprint }),
  };
  createStage0ArtifactEvidence(options);
  assert.throws(() => createStage0ArtifactEvidence(options), /EEXIST/);

  fs.rmSync(values.outputPath);
  let call = 0;
  assert.throws(
    () =>
      createStage0ArtifactEvidence({
        ...options,
        signatureProbe: () => ({
          status: "Valid",
          thumbprint: call++ === 0 ? thumbprint : "0".repeat(40),
        }),
      }),
    /署名者が一致しません/,
  );
});

test("Stage 0 artifact evidence requires Valid signatures and safe paths", (t) => {
  const values = fixture(t);
  const options = {
    desktopRoot: values.root,
    directoryName: "release",
    productExecutablePath: values.productExecutablePath,
    outputPath: values.outputPath,
    verifyRelease: () => {},
    signatureProbe: () => ({ status: "NotSigned", thumbprint: null }),
  };
  assert.throws(() => createStage0ArtifactEvidence(options), /有効な署名/);
  assert.throws(
    () =>
      createStage0ArtifactEvidence({
        ...options,
        directoryName: "..",
        signatureProbe: () => ({ status: "Valid", thumbprint }),
      }),
    /単一名/,
  );
  assert.throws(
    () =>
      createStage0ArtifactEvidence({
        ...options,
        outputPath: "evidence.json",
        signatureProbe: () => ({ status: "Valid", thumbprint }),
      }),
    /絶対path/,
  );
});
