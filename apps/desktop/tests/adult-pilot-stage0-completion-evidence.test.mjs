import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createStage0CompletionEvidence,
  verifyStage0CompletionEvidenceForImport,
} from "../scripts/adult-pilot-stage0-completion-evidence.mjs";

const write = (root, name, value) => {
  const target = path.join(root, name);
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
};

const hardwareEvidence = () => ({
  format: "mangai.phase5-hardware-evidence",
  version: 1,
  profile: "vram_12gb",
  hardware: {
    totalRamBytes: 32 * 1024 ** 3,
    gpuName: "Acceptance GPU",
    dedicatedVramMb: 12 * 1024,
  },
  checkedAt: "2026-09-16T11:00:00.000Z",
  projectIdSha256: "a".repeat(64),
  operations: [
    "text_to_image",
    "image_to_image",
    "controlnet",
    "inpainting",
  ].map((operation, index) => ({
    operation,
    result: "passed",
    outputSha256: String(index + 1).repeat(64),
    completedAt: `2026-09-16T10:${String(index + 10).padStart(2, "0")}:00.000Z`,
  })),
  export: {
    pdfSha256: "b".repeat(64),
    salesPackageSha256: "c".repeat(64),
    createdAt: "2026-09-16T10:45:00.000Z",
  },
});

const fixture = (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-stage0-completion-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, "repository");
  const privateRoot = path.join(root, "private");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(privateRoot);
  const packagePath = write(privateRoot, "operation-package.json", {
    package: true,
  });
  const packageSha256 = crypto
    .createHash("sha256")
    .update(fs.readFileSync(packagePath))
    .digest("hex");
  const hardwareEvidencePath = write(
    privateRoot,
    "hardware-evidence.json",
    hardwareEvidence(),
  );
  return {
    repositoryRoot,
    privateRoot,
    packagePath,
    authorizationPath: path.join(privateRoot, "authorization.json"),
    hardwareEvidencePath,
    assessmentPath: path.join(privateRoot, "assessment.json"),
    planPath: path.join(privateRoot, "plan.json"),
    artifactEvidencePath: path.join(privateRoot, "artifact.json"),
    bundleEvidencePath: path.join(privateRoot, "bundle.json"),
    now: new Date("2026-09-16T11:05:00.000Z"),
    consumedAuthorizationVerifier: () => ({
      operationPackage: {
        candidateId: "candidate-a1b2c3d4e5f6",
        artifactVersion: "0.1.0",
        deleteBy: "2026-09-20T00:00:00.000Z",
      },
      packageSha256,
      receipt: {
        consumedAt: "2026-09-16T10:00:00.000Z",
      },
      receiptSha256: "e".repeat(64),
    }),
  };
};

test("Stage 0 completion binds one consumed session to 12GB evidence", (t) => {
  const values = fixture(t);
  const { completion, outputPath } = createStage0CompletionEvidence(values);
  assert.equal(outputPath, `${values.packagePath}.stage0-completion.json`);
  assert.equal(completion.stage0AcceptancePassed, true);
  assert.equal(completion.stage1DistributionAuthorized, false);
  assert.equal(completion.profile, "vram_12gb");
  const serialized = fs.readFileSync(outputPath, "utf8");
  assert.doesNotMatch(
    serialized,
    /Acceptance GPU|private|repository|hardware-evidence\.json/i,
  );
  const verified = verifyStage0CompletionEvidenceForImport({
    repositoryRoot: values.repositoryRoot,
    completionPath: outputPath,
    hardwareEvidencePath: values.hardwareEvidencePath,
    packagePath: values.packagePath,
  });
  assert.equal(verified.completionSha256.length, 64);
});

test("Stage 0 completion accepts only evidence created after start consumption", (t) => {
  const values = fixture(t);
  const evidence = hardwareEvidence();
  evidence.operations[0].completedAt = "2026-09-16T09:59:59.999Z";
  fs.writeFileSync(values.hardwareEvidencePath, JSON.stringify(evidence));
  assert.throws(() => createStage0CompletionEvidence(values), /開始消費後/);
});

test("Stage 0 completion requires exact four-mode 12GB evidence", (t) => {
  const wrongProfile = fixture(t);
  const profileEvidence = hardwareEvidence();
  profileEvidence.profile = "vram_8gb";
  profileEvidence.hardware.dedicatedVramMb = 8192;
  fs.writeFileSync(
    wrongProfile.hardwareEvidencePath,
    JSON.stringify(profileEvidence),
  );
  assert.throws(() => createStage0CompletionEvidence(wrongProfile), /12GB条件/);

  const duplicate = fixture(t);
  const duplicateEvidence = hardwareEvidence();
  duplicateEvidence.operations[3].operation = "controlnet";
  fs.writeFileSync(
    duplicate.hardwareEvidencePath,
    JSON.stringify(duplicateEvidence),
  );
  assert.throws(
    () => createStage0CompletionEvidence(duplicate),
    /operation証跡/,
  );
});

test("Stage 0 completion refuses overwrite and unsafe evidence paths", (t) => {
  const values = fixture(t);
  createStage0CompletionEvidence(values);
  assert.throws(() => createStage0CompletionEvidence(values), /EEXIST/);

  const unsafe = fixture(t);
  const unsafeEvidencePath = write(
    unsafe.repositoryRoot,
    "hardware.json",
    hardwareEvidence(),
  );
  assert.throws(
    () =>
      createStage0CompletionEvidence({
        ...unsafe,
        hardwareEvidencePath: unsafeEvidencePath,
      }),
    /Git管理外/,
  );
});

test("Stage 0 completion import rejects tampering and moved evidence", (t) => {
  const values = fixture(t);
  const { outputPath } = createStage0CompletionEvidence(values);
  const tampered = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  tampered.stage1DistributionAuthorized = true;
  fs.writeFileSync(outputPath, JSON.stringify(tampered));
  assert.throws(
    () =>
      verifyStage0CompletionEvidenceForImport({
        repositoryRoot: values.repositoryRoot,
        completionPath: outputPath,
        hardwareEvidencePath: values.hardwareEvidencePath,
        packagePath: values.packagePath,
      }),
    /一致しません/,
  );

  const moved = fixture(t);
  const created = createStage0CompletionEvidence(moved);
  const copiedEvidence = path.join(moved.privateRoot, "copied-evidence.json");
  fs.copyFileSync(moved.hardwareEvidencePath, copiedEvidence);
  assert.throws(
    () =>
      verifyStage0CompletionEvidenceForImport({
        repositoryRoot: moved.repositoryRoot,
        completionPath: created.outputPath,
        hardwareEvidencePath: copiedEvidence,
        packagePath: moved.packagePath,
      }),
    /一致しません/,
  );

  const copiedCompletion = path.join(
    moved.privateRoot,
    "copied-operation-package.json.stage0-completion.json",
  );
  fs.copyFileSync(created.outputPath, copiedCompletion);
  assert.throws(
    () =>
      verifyStage0CompletionEvidenceForImport({
        repositoryRoot: moved.repositoryRoot,
        completionPath: copiedCompletion,
        hardwareEvidencePath: moved.hardwareEvidencePath,
        packagePath: moved.packagePath,
      }),
    /元operation packageの隣/,
  );

  const changedPackage = fixture(t);
  const linked = createStage0CompletionEvidence(changedPackage);
  fs.appendFileSync(changedPackage.packagePath, " ");
  assert.throws(
    () =>
      verifyStage0CompletionEvidenceForImport({
        repositoryRoot: changedPackage.repositoryRoot,
        completionPath: linked.outputPath,
        hardwareEvidencePath: changedPackage.hardwareEvidencePath,
        packagePath: changedPackage.packagePath,
      }),
    /元operation packageと一致しません/,
  );
});

test("Stage 0 completion fails closed when consumed session verification fails", (t) => {
  const values = fixture(t);
  values.consumedAuthorizationVerifier = () => {
    throw new Error("consumed session invalid");
  };
  assert.throws(
    () => createStage0CompletionEvidence(values),
    /consumed session invalid/,
  );
  assert.equal(
    fs.existsSync(`${values.packagePath}.stage0-completion.json`),
    false,
  );
});
