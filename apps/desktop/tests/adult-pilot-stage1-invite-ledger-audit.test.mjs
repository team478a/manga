import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { auditStage1InviteLedgerProposal } from "../scripts/adult-pilot-stage1-invite-ledger-audit.mjs";
import { applyStage1InviteLedgerProposal } from "../scripts/adult-pilot-stage1-invite-ledger-apply.mjs";
import { createStage1InviteLedgerProposal } from "../scripts/adult-pilot-stage1-invite-ledger-proposal.mjs";

const auditScript = fileURLToPath(
  new URL(
    "../scripts/adult-pilot-stage1-invite-ledger-audit.mjs",
    import.meta.url,
  ),
);
const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const locationDigest = (target) => {
  const resolved = path.resolve(target);
  const canonical =
    process.platform === "win32" ? resolved.toLowerCase() : resolved;
  return digest(Buffer.from(canonical, "utf8"));
};
const sourceBinding = (target) =>
  `${digest(fs.readFileSync(target))}:${locationDigest(target)}`;
const write = (target, value) => {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
};
const directorySnapshot = (root) =>
  Object.fromEntries(
    fs
      .readdirSync(root)
      .sort()
      .map((name) => [name, digest(fs.readFileSync(path.join(root, name)))]),
  );

const fixture = (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-stage1-ledger-audit-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, "repository");
  const privateRoot = path.join(root, "private");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(privateRoot);
  const assessmentPath = write(path.join(privateRoot, "assessment.json"), {
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
  });
  const ledgerPath = write(path.join(privateRoot, "ledger.json"), {
    format: "mangai.desktop-adult-pilot-invite-ledger",
    version: 1,
    entries: [],
  });
  const originalLedgerBytes = fs.readFileSync(ledgerPath);
  const authorizationPath = path.join(privateRoot, "authorization.json");
  const authorization = {
    format: "mangai.desktop-adult-stage1-invitation-authorization",
    version: 1,
    approvedAt: "2026-09-16T12:00:00.000Z",
    expiresAt: "2026-09-16T13:00:00.000Z",
    authorizationLocationSha256: locationDigest(authorizationPath),
    candidateId: "candidate-a1b2c3d4e5f6",
    monitorId: "monitor-012345abcdef",
    pilotVersion: "0.1.0-beta.1",
    stage: 1,
    sources: {
      assessment: sourceBinding(assessmentPath),
      operationPackage: `${"1".repeat(64)}:${"2".repeat(64)}`,
      completion: `${"3".repeat(64)}:${"4".repeat(64)}`,
      ledger: sourceBinding(ledgerPath),
      rc: `${"5".repeat(64)}:${"6".repeat(64)}`,
      bundle: `${"7".repeat(64)}:${"8".repeat(64)}`,
      hardware: `${"9".repeat(64)}:${"a".repeat(64)}`,
      approvals: `${"b".repeat(64)}:${"c".repeat(64)}`,
    },
    ownerApproved: true,
    signedPilotArtifactConfirmed: true,
    assistedFirstPanelConfirmed: true,
    observation24HoursConfirmed: true,
    manualStopConstraintAccepted: true,
    stage1DistributionAuthorized: true,
  };
  write(authorizationPath, authorization);
  write(`${authorizationPath}.consumed.json`, {
    format: "mangai.desktop-adult-stage1-invitation-receipt",
    version: 1,
    consumedAt: "2026-09-16T12:01:00.000Z",
    authorizationSha256: digest(fs.readFileSync(authorizationPath)),
    candidateId: authorization.candidateId,
    monitorId: authorization.monitorId,
    pilotVersion: authorization.pilotVersion,
    stage: 1,
    stage1DistributionAuthorized: true,
    nextStep: "manual_distribution_then_invite_ledger_record",
  });
  createStage1InviteLedgerProposal({
    repositoryRoot,
    authorizationPath,
    assessmentPath,
    ledgerPath,
    distributedAt: "2026-09-16T12:05:00.000Z",
    now: new Date("2026-09-16T12:06:00.000Z"),
    confirmManualDistributionCompleted: true,
    confirmRecipientMatched: true,
    confirmStopContactShared: true,
    confirmContentRemainedLocal: true,
  });
  return {
    repositoryRoot,
    privateRoot,
    authorizationPath,
    assessmentPath,
    ledgerPath,
    proposalPath: `${authorizationPath}.ledger-proposal.json`,
    backupPath: `${authorizationPath}.ledger-before-apply.json`,
    intentPath: `${authorizationPath}.ledger-apply-intent.json`,
    appliedReceiptPath: `${authorizationPath}.ledger-applied.json`,
    originalLedgerBytes,
    now: new Date("2026-09-16T12:07:00.000Z"),
    confirmProposalReviewed: true,
    confirmRecoveryBackup: true,
    confirmLedgerApply: true,
  };
};

test("Stage 1 ledger audit reports a ready proposal without writes", (t) => {
  const values = fixture(t);
  const before = directorySnapshot(values.privateRoot);
  assert.deepEqual(auditStage1InviteLedgerProposal(values), {
    state: "PROPOSAL_READY",
    stage: 1,
  });
  assert.deepEqual(directorySnapshot(values.privateRoot), before);
});

test("Stage 1 ledger audit reports prepared apply evidence", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      applyStage1InviteLedgerProposal({
        ...values,
        beforeCommit: () => {
          throw new Error("simulated interruption");
        },
      }),
    /simulated interruption/,
  );
  assert.equal(auditStage1InviteLedgerProposal(values).state, "APPLY_PREPARED");
  assert.deepEqual(
    fs.readFileSync(values.ledgerPath),
    values.originalLedgerBytes,
  );
});

test("Stage 1 ledger audit reports receipt recovery after commit", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      applyStage1InviteLedgerProposal({
        ...values,
        afterLedgerCommit: () => {
          throw new Error("simulated interruption");
        },
      }),
    /simulated interruption/,
  );
  assert.equal(
    auditStage1InviteLedgerProposal(values).state,
    "RECOVERY_REQUIRED",
  );
  assert.equal(fs.existsSync(values.appliedReceiptPath), false);
});

test("Stage 1 ledger audit validates completed apply without writes", (t) => {
  const values = fixture(t);
  applyStage1InviteLedgerProposal(values);
  const before = directorySnapshot(values.privateRoot);
  assert.equal(auditStage1InviteLedgerProposal(values).state, "APPLIED");
  assert.deepEqual(directorySnapshot(values.privateRoot), before);
});

test("Stage 1 ledger audit remains available after authorization expiry", (t) => {
  const values = fixture(t);
  applyStage1InviteLedgerProposal(values);
  assert.equal(
    auditStage1InviteLedgerProposal({
      ...values,
      now: new Date("2026-09-17T12:07:00.000Z"),
    }).state,
    "APPLIED",
  );
});

test("Stage 1 ledger audit rejects tampered applied receipt", (t) => {
  const values = fixture(t);
  applyStage1InviteLedgerProposal(values);
  const receipt = JSON.parse(
    fs.readFileSync(values.appliedReceiptPath, "utf8"),
  );
  receipt.authorizationSha256 = "0".repeat(64);
  write(values.appliedReceiptPath, receipt);
  assert.throws(
    () => auditStage1InviteLedgerProposal(values),
    /receiptが承認済みproposalと一致しません/,
  );
});

test("Stage 1 ledger audit rejects incomplete or contradictory evidence", (t) => {
  const incomplete = fixture(t);
  fs.writeFileSync(incomplete.backupPath, incomplete.originalLedgerBytes);
  assert.throws(
    () => auditStage1InviteLedgerProposal(incomplete),
    /証跡が不完全/,
  );

  const contradictory = fixture(t);
  applyStage1InviteLedgerProposal(contradictory);
  fs.writeFileSync(contradictory.ledgerPath, contradictory.originalLedgerBytes);
  assert.throws(
    () => auditStage1InviteLedgerProposal(contradictory),
    /receiptと現在の招待台帳/,
  );
});

test("Stage 1 ledger audit rejects target ledger without evidence", (t) => {
  const values = fixture(t);
  fs.copyFileSync(values.proposalPath, values.ledgerPath);
  assert.throws(
    () => auditStage1InviteLedgerProposal(values),
    /回復証跡がありません/,
  );
});

test("Stage 1 ledger audit rejects changed source and proposal", (t) => {
  const changedSource = fixture(t);
  fs.appendFileSync(changedSource.ledgerPath, " ");
  assert.throws(
    () => auditStage1InviteLedgerProposal(changedSource),
    /適用前台帳が承認時点と一致しません/,
  );

  const changedProposal = fixture(t);
  fs.appendFileSync(changedProposal.proposalPath, " ");
  assert.throws(
    () => auditStage1InviteLedgerProposal(changedProposal),
    /完全一致/,
  );
});

test("Stage 1 ledger audit rejects repository paths", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      auditStage1InviteLedgerProposal({
        ...values,
        repositoryRoot: values.privateRoot,
      }),
    /Git管理外/,
  );
});

test("Stage 1 ledger audit CLI hides identities and paths", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      applyStage1InviteLedgerProposal({
        ...values,
        beforeCommit: () => {
          throw new Error("simulated interruption");
        },
      }),
    /simulated interruption/,
  );
  const result = spawnSync(
    process.execPath,
    [
      auditScript,
      "--authorization",
      values.authorizationPath,
      "--assessment",
      values.assessmentPath,
      "--ledger",
      values.ledgerPath,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /State: APPLY_PREPARED/);
  assert.match(result.stdout, /Files changed: no/);
  assert.doesNotMatch(
    result.stdout,
    /candidate-|monitor-|authorization\.json|assessment\.json|ledger\.json/i,
  );
});
