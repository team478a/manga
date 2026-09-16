import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  consumeStage1InvitationAuthorization,
  createStage1InvitationAuthorization,
} from "../scripts/adult-pilot-stage1-invitation-authorization.mjs";

const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");

const locationDigest = (target) => {
  const resolved = path.resolve(target);
  const canonical =
    process.platform === "win32" ? resolved.toLowerCase() : resolved;
  return digest(Buffer.from(canonical, "utf8"));
};

const write = (root, name, value) => {
  const target = path.join(root, name);
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
};

const fixture = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-stage1-auth-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, "repository");
  const privateRoot = path.join(root, "private");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(privateRoot);

  const assessment = {
    format: "mangai.desktop-adult-technical-monitor-assessment",
    version: 1,
    candidateId: "candidate-a1b2c3d4e5f6",
    evaluatedAt: "2026-09-16T08:00:00.000Z",
    eligible: true,
    environment: {
      windows: "windows_11",
      gpuVendor: "nvidia",
      vramBand: "12gb",
      ramBand: "32gb_or_more",
      freeDiskBand: "50gb_or_more",
    },
    failedChecks: [],
    warnings: [],
    distributionAuthorized: false,
    nextStep: "signed_acceptance_artifact_and_release_readiness_required",
  };
  const packagePath = write(privateRoot, "stage0-operation-package.json", {
    format: "mangai.desktop-adult-stage0-operation-package",
    version: 1,
    candidateId: assessment.candidateId,
    artifactVersion: "0.1.0",
    artifactPurpose: "stage0_acceptance_only",
  });
  const completion = {
    format: "mangai.desktop-adult-stage0-completion-evidence",
    version: 1,
    completedAt: "2026-09-16T10:00:00.000Z",
    operationPackageSha256: digest(fs.readFileSync(packagePath)),
    operationPackageLocationSha256: locationDigest(packagePath),
    startReceiptSha256: "c".repeat(64),
    hardwareEvidenceSha256: "d".repeat(64),
    hardwareEvidenceLocationSha256: "e".repeat(64),
    candidateId: assessment.candidateId,
    artifactVersion: "0.1.0",
    artifactPurpose: "stage0_acceptance_only",
    profile: "vram_12gb",
    consumedAt: "2026-09-16T09:00:00.000Z",
    checkedAt: "2026-09-16T09:50:00.000Z",
    deleteBy: "2026-09-20T00:00:00.000Z",
    stage0AcceptancePassed: true,
    stage1DistributionAuthorized: false,
  };
  const assessmentPath = write(privateRoot, "assessment.json", assessment);
  const completionPath = `${packagePath}.stage0-completion.json`;
  fs.writeFileSync(completionPath, `${JSON.stringify(completion, null, 2)}\n`);
  const ledgerPath = write(privateRoot, "ledger.json", {
    format: "mangai.desktop-adult-pilot-invite-ledger",
    version: 1,
    entries: [],
  });
  const rc = write(privateRoot, "rc.json", { ready: true });
  const bundle = write(privateRoot, "bundle.json", { fixed: true });
  const approvals = write(privateRoot, "approvals.json", { approved: true });
  const completionSha256 = digest(fs.readFileSync(completionPath));
  const hardware = write(privateRoot, "hardware.json", {
    format: "mangai.phase5-hardware-acceptance",
    version: 1,
    profiles: [
      {
        profile: "vram_12gb",
        status: "passed",
        stage0Completion: {
          status: "passed",
          completionSha256,
          operationPackageSha256: completion.operationPackageSha256,
          startReceiptSha256: completion.startReceiptSha256,
          hardwareEvidenceSha256: completion.hardwareEvidenceSha256,
          stage1DistributionAuthorized: false,
        },
      },
    ],
  });
  const authorizationPath = path.join(privateRoot, "stage1-authorization.json");
  return {
    repositoryRoot,
    privateRoot,
    assessmentPath,
    packagePath,
    completionPath,
    ledgerPath,
    sourcePaths: { rc, bundle, hardware, approvals },
    releaseReadinessVerifier: () => undefined,
    pilotVersion: "0.1.0-beta.1",
    expiresAt: "2026-09-17T00:00:00.000Z",
    outputPath: authorizationPath,
    authorizationPath,
    monitorId: "monitor-012345abcdef",
    now: new Date("2026-09-16T12:00:00.000Z"),
    confirmOwnerApproved: true,
    confirmSignedPilotArtifact: true,
    confirmAssistedFirstPanel: true,
    confirmObservation24Hours: true,
    confirmManualStop: true,
  };
};

test("Stage 1 invitation authorization binds a ready candidate without private data", (t) => {
  const values = fixture(t);
  const authorization = createStage1InvitationAuthorization(values);
  assert.equal(authorization.stage1DistributionAuthorized, true);
  assert.equal(authorization.stage, 1);
  assert.equal(authorization.monitorId, values.monitorId);
  assert.equal(Object.keys(authorization.sources).length, 8);
  const serialized = fs.readFileSync(values.authorizationPath, "utf8");
  assert.doesNotMatch(serialized, /private|repository|assessment\.json|@/i);
});

test("Stage 1 invitation authorization requires every explicit confirmation", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      createStage1InvitationAuthorization({
        ...values,
        confirmObservation24Hours: false,
      }),
    /明示確認/,
  );
  assert.equal(fs.existsSync(values.authorizationPath), false);
});

test("Stage 1 invitation authorization stays blocked until release readiness strict passes", (t) => {
  const values = fixture(t);
  values.releaseReadinessVerifier = () => {
    throw new Error("統合release readiness strictが成功していません。");
  };
  assert.throws(
    () => createStage1InvitationAuthorization(values),
    /readiness strict/,
  );
  assert.equal(fs.existsSync(values.authorizationPath), false);
});

test("Stage 1 invitation authorization rejects mismatched completion and acceptance", (t) => {
  const values = fixture(t);
  const completion = JSON.parse(fs.readFileSync(values.completionPath, "utf8"));
  completion.candidateId = "candidate-ffffffffffff";
  fs.writeFileSync(
    values.completionPath,
    `${JSON.stringify(completion, null, 2)}\n`,
  );
  assert.throws(
    () => createStage1InvitationAuthorization(values),
    /一致しません/,
  );
});

test("Stage 1 invitation authorization rejects copied Stage 0 package evidence", (t) => {
  const values = fixture(t);
  const copiedPackagePath = path.join(
    values.privateRoot,
    "copied-package.json",
  );
  const copiedCompletionPath = `${copiedPackagePath}.stage0-completion.json`;
  fs.copyFileSync(values.packagePath, copiedPackagePath);
  fs.copyFileSync(values.completionPath, copiedCompletionPath);
  assert.throws(
    () =>
      createStage1InvitationAuthorization({
        ...values,
        packagePath: copiedPackagePath,
        completionPath: copiedCompletionPath,
      }),
    /一致しません/,
  );
});

test("Stage 1 invitation authorization rejects private data hidden in assessment arrays", (t) => {
  const values = fixture(t);
  const assessment = JSON.parse(fs.readFileSync(values.assessmentPath, "utf8"));
  assessment.warnings = ["person@example.com"];
  fs.writeFileSync(values.assessmentPath, JSON.stringify(assessment));
  assert.throws(
    () => createStage1InvitationAuthorization(values),
    /個人情報またはlocal path/,
  );
});

test("Stage 1 invitation authorization rejects source changes during verification", (t) => {
  const values = fixture(t);
  values.releaseReadinessVerifier = () =>
    fs.appendFileSync(values.sourcePaths.bundle, " ");
  assert.throws(
    () => createStage1InvitationAuthorization(values),
    /検証中に変更/,
  );
});

test("Stage 1 invitation authorization rejects live Stage 1 and private ledger data", (t) => {
  const values = fixture(t);
  const liveEntry = {
    monitorId: "monitor-fedcba654321",
    stage: 1,
    status: "INVITED",
    desktopVersion: "0.1.0-beta.1",
    environment: { windows: "windows_11", vramBand: "12gb" },
    distributedAt: "2026-09-16T11:00:00.000Z",
    consentedAt: null,
    stoppedAt: null,
  };
  fs.writeFileSync(
    values.ledgerPath,
    JSON.stringify({
      format: "mangai.desktop-adult-pilot-invite-ledger",
      version: 1,
      entries: [liveEntry],
    }),
  );
  assert.throws(
    () => createStage1InvitationAuthorization(values),
    /進行中の招待/,
  );

  liveEntry.status = "WITHDRAWN";
  liveEntry.email = "person@example.com";
  fs.writeFileSync(
    values.ledgerPath,
    JSON.stringify({
      format: "mangai.desktop-adult-pilot-invite-ledger",
      version: 1,
      entries: [liveEntry],
    }),
  );
  assert.throws(
    () => createStage1InvitationAuthorization(values),
    /field構成|保存禁止/,
  );
});

test("Stage 1 invitation authorization enforces a 24-hour evidence-bound lifetime", (t) => {
  const tooLong = fixture(t);
  tooLong.expiresAt = "2026-09-17T12:00:00.001Z";
  assert.throws(
    () => createStage1InvitationAuthorization(tooLong),
    /24時間以内/,
  );

  const afterEvidenceExpiry = fixture(t);
  afterEvidenceExpiry.expiresAt = "2026-09-20T00:00:00.000Z";
  assert.throws(
    () => createStage1InvitationAuthorization(afterEvidenceExpiry),
    /削除期限内/,
  );
});

test("Stage 1 invitation authorization is consumed once without distributing automatically", (t) => {
  const values = fixture(t);
  createStage1InvitationAuthorization(values);
  const { receipt, receiptPath } = consumeStage1InvitationAuthorization(values);
  assert.equal(receipt.stage1DistributionAuthorized, true);
  assert.equal(
    receipt.nextStep,
    "manual_distribution_then_invite_ledger_record",
  );
  assert.equal(receiptPath, `${values.authorizationPath}.consumed.json`);
  assert.throws(() => consumeStage1InvitationAuthorization(values), /EEXIST/);
});

test("Stage 1 invitation authorization rejects tampering, expiry, and copied authorization", (t) => {
  const values = fixture(t);
  createStage1InvitationAuthorization(values);
  const authorization = JSON.parse(
    fs.readFileSync(values.authorizationPath, "utf8"),
  );
  authorization.manualStopConstraintAccepted = false;
  fs.writeFileSync(values.authorizationPath, JSON.stringify(authorization));
  assert.throws(() => consumeStage1InvitationAuthorization(values), /安全境界/);

  const expired = fixture(t);
  createStage1InvitationAuthorization(expired);
  assert.throws(
    () =>
      consumeStage1InvitationAuthorization({
        ...expired,
        now: new Date("2026-09-17T00:00:00.000Z"),
      }),
    /有効期間外/,
  );

  const copied = fixture(t);
  createStage1InvitationAuthorization(copied);
  const copiedPath = path.join(copied.privateRoot, "copied-authorization.json");
  fs.copyFileSync(copied.authorizationPath, copiedPath);
  assert.throws(
    () =>
      consumeStage1InvitationAuthorization({
        ...copied,
        authorizationPath: copiedPath,
      }),
    /安全境界/,
  );
});

test("Stage 1 invitation authorization rejects repository output and overwrite", (t) => {
  const unsafe = fixture(t);
  assert.throws(
    () =>
      createStage1InvitationAuthorization({
        ...unsafe,
        outputPath: path.join(unsafe.repositoryRoot, "authorization.json"),
      }),
    /Git管理外/,
  );

  const overwrite = fixture(t);
  fs.writeFileSync(overwrite.authorizationPath, "existing");
  assert.throws(() => createStage1InvitationAuthorization(overwrite), /EEXIST/);
});
