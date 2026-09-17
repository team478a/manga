import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  consumeStage0StartAuthorization,
  createStage0StartAuthorization,
  verifyConsumedStage0StartAuthorization,
  verifyStage0StartAuthorization,
} from "../scripts/adult-pilot-stage0-start-authorization.mjs";

const write = (root, name, value) => {
  const target = path.join(root, name);
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
};

const fixture = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-stage0-start-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, "repository");
  const privateRoot = path.join(root, "private");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(privateRoot);
  const operationPackage = {
    format: "mangai.desktop-adult-stage0-operation-package",
    version: 1,
    createdAt: "2026-09-16T09:00:00.000Z",
    candidateId: "candidate-a1b2c3d4e5f6",
    artifactVersion: "0.1.0",
    artifactPurpose: "stage0_acceptance_only",
    scheduledStartAt: "2026-09-16T09:30:00.000Z",
    deleteBy: "2026-09-20T00:00:00.000Z",
    sources: {
      candidateAssessmentSha256: "a".repeat(64),
      stage0PlanSha256: "b".repeat(64),
      artifactEvidenceSha256: "c".repeat(64),
      bundleEvidenceSha256: "d".repeat(64),
      fixedBundleManifestSha256: "e".repeat(64),
      ownerApprovalsSha256: "f".repeat(64),
    },
    stage0Ready: true,
    stage1DistributionAuthorized: false,
  };
  const packagePath = write(
    privateRoot,
    "operation-package.json",
    operationPackage,
  );
  const authorizationPath = path.join(privateRoot, "start-authorization.json");
  return {
    repositoryRoot,
    privateRoot,
    packagePath,
    outputPath: authorizationPath,
    authorizationPath,
    assessmentPath: path.join(privateRoot, "assessment.json"),
    planPath: path.join(privateRoot, "plan.json"),
    artifactEvidencePath: path.join(privateRoot, "artifact.json"),
    bundleEvidencePath: path.join(privateRoot, "bundle.json"),
    operationPackageVerifier: () => operationPackage,
    now: new Date("2026-09-16T10:00:00.000Z"),
    confirmOwnerApproved: true,
    confirmAcceptanceOnly: true,
    confirmManualStop: true,
    confirmStage1Blocked: true,
  };
};

test("Stage 0 start authorization binds one verified operation package", (t) => {
  const values = fixture(t);
  const authorization = createStage0StartAuthorization(values);
  assert.equal(authorization.stage0StartAuthorized, true);
  assert.equal(authorization.stage1DistributionAuthorized, false);
  assert.equal(
    authorization.operationPackageSha256,
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(values.packagePath))
      .digest("hex"),
  );
  const serialized = fs.readFileSync(values.authorizationPath, "utf8");
  assert.doesNotMatch(serialized, /private|repository|assessment\.json/i);
});

test("Stage 0 start authorization requires all explicit confirmations", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      createStage0StartAuthorization({
        ...values,
        confirmManualStop: false,
      }),
    /明示確認/,
  );
  assert.equal(fs.existsSync(values.authorizationPath), false);
});

test("Stage 0 start authorization requires the current verified package", (t) => {
  const values = fixture(t);
  values.operationPackageVerifier = () => {
    throw new Error("operation package verification failed");
  };
  assert.throws(
    () => createStage0StartAuthorization(values),
    /operation package verification failed/,
  );
  assert.equal(fs.existsSync(values.authorizationPath), false);
});

test("Stage 0 start authorization rejects a package changed during verification", (t) => {
  const values = fixture(t);
  const verified = values.operationPackageVerifier();
  values.operationPackageVerifier = () => {
    fs.appendFileSync(values.packagePath, " ");
    return verified;
  };
  assert.throws(() => createStage0StartAuthorization(values), /検証中に変更/);
  assert.equal(fs.existsSync(values.authorizationPath), false);
});

test("Stage 0 start authorization is consumed once with a fixed receipt", (t) => {
  const values = fixture(t);
  createStage0StartAuthorization(values);
  const { receipt, receiptPath } = consumeStage0StartAuthorization(values);
  assert.equal(receipt.stage0StartAuthorized, true);
  assert.equal(receipt.stage1DistributionAuthorized, false);
  assert.equal(receiptPath, `${values.packagePath}.stage0-start-consumed.json`);
  assert.equal(fs.existsSync(receiptPath), true);
  const verified = verifyConsumedStage0StartAuthorization(values);
  assert.equal(verified.receiptSha256.length, 64);
  assert.equal(verified.receipt.candidateId, receipt.candidateId);
  assert.throws(() => consumeStage0StartAuthorization(values), /EEXIST/);
});

test("Stage 0 start authorization can be audited read-only after expiry", (t) => {
  const values = fixture(t);
  createStage0StartAuthorization(values);
  consumeStage0StartAuthorization(values);
  const historical = {
    ...values,
    now: new Date("2026-09-20T00:00:00.000Z"),
    allowHistoricalExpired: true,
  };
  assert.equal(
    verifyStage0StartAuthorization(historical).authorization.candidateId,
    "candidate-a1b2c3d4e5f6",
  );
  assert.equal(
    verifyConsumedStage0StartAuthorization(historical).receipt.candidateId,
    "candidate-a1b2c3d4e5f6",
  );
  assert.throws(
    () =>
      verifyConsumedStage0StartAuthorization({
        ...historical,
        allowHistoricalExpired: false,
      }),
    /削除期限/,
  );
});

test("Stage 0 start authorization cannot be consumed before its scheduled start", (t) => {
  const values = fixture(t);
  const operationPackage = JSON.parse(
    fs.readFileSync(values.packagePath, "utf8"),
  );
  operationPackage.scheduledStartAt = "2026-09-16T10:30:00.000Z";
  fs.writeFileSync(
    values.packagePath,
    `${JSON.stringify(operationPackage, null, 2)}\n`,
  );
  values.operationPackageVerifier = () => operationPackage;
  createStage0StartAuthorization(values);
  assert.throws(
    () =>
      consumeStage0StartAuthorization({
        ...values,
        now: new Date("2026-09-16T10:29:59.999Z"),
      }),
    /予定開始日時より前/,
  );
});

test("Stage 0 start authorization rejects tampering, expiry, and unsafe output", (t) => {
  const values = fixture(t);
  createStage0StartAuthorization(values);
  const authorization = JSON.parse(
    fs.readFileSync(values.authorizationPath, "utf8"),
  );
  authorization.stage1DistributionAuthorized = true;
  fs.writeFileSync(values.authorizationPath, JSON.stringify(authorization));
  assert.throws(
    () => consumeStage0StartAuthorization(values),
    /operation packageと一致しません/,
  );

  const expired = fixture(t);
  expired.now = new Date("2026-09-20T00:00:00.000Z");
  assert.throws(() => createStage0StartAuthorization(expired), /削除期限/);

  const unsafe = fixture(t);
  assert.throws(
    () =>
      createStage0StartAuthorization({
        ...unsafe,
        outputPath: path.join(unsafe.repositoryRoot, "authorization.json"),
      }),
    /Git管理外/,
  );
});

test("Stage 0 start authorization rejects invalid approval time boundaries", (t) => {
  const values = fixture(t);
  createStage0StartAuthorization(values);
  assert.throws(
    () =>
      consumeStage0StartAuthorization({
        ...values,
        now: new Date("2026-09-16T09:59:59.999Z"),
      }),
    /承認日時より前/,
  );

  const authorization = JSON.parse(
    fs.readFileSync(values.authorizationPath, "utf8"),
  );
  authorization.approvedAt = authorization.deleteBy;
  fs.writeFileSync(values.authorizationPath, JSON.stringify(authorization));
  assert.throws(
    () => consumeStage0StartAuthorization(values),
    /有効期間が不正/,
  );
});

test("Stage 0 start authorization cannot move to another package copy", (t) => {
  const values = fixture(t);
  createStage0StartAuthorization(values);
  const copiedPackagePath = path.join(
    values.privateRoot,
    "copied-package.json",
  );
  fs.copyFileSync(values.packagePath, copiedPackagePath);
  assert.throws(
    () =>
      consumeStage0StartAuthorization({
        ...values,
        packagePath: copiedPackagePath,
      }),
    /operation packageと一致しません/,
  );
});
