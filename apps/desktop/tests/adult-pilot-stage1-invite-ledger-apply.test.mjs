import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { applyStage1InviteLedgerProposal } from "../scripts/adult-pilot-stage1-invite-ledger-apply.mjs";
import { createStage1InviteLedgerProposal } from "../scripts/adult-pilot-stage1-invite-ledger-proposal.mjs";

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

const fixture = (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-stage1-ledger-apply-"),
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

test("Stage 1 ledger apply replaces the ledger and preserves a content-free recovery backup", (t) => {
  const values = fixture(t);
  const result = applyStage1InviteLedgerProposal(values);
  assert.equal(result.recovered, false);
  assert.deepEqual(
    fs.readFileSync(values.ledgerPath),
    fs.readFileSync(values.proposalPath),
  );
  assert.deepEqual(
    fs.readFileSync(values.backupPath),
    values.originalLedgerBytes,
  );
  const appliedReceipt = JSON.parse(
    fs.readFileSync(values.appliedReceiptPath, "utf8"),
  );
  assert.equal(appliedReceipt.result, "APPLIED");
  assert.equal(appliedReceipt.recoveredAfterCommitInterruption, false);
  for (const target of [
    values.backupPath,
    values.intentPath,
    values.appliedReceiptPath,
  ])
    assert.doesNotMatch(
      fs.readFileSync(target, "utf8"),
      /candidate-|@|authorization\.json|private/i,
    );
});

test("Stage 1 ledger apply requires every explicit confirmation", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      applyStage1InviteLedgerProposal({
        ...values,
        confirmProposalReviewed: false,
      }),
    /明示確認/,
  );
  assert.deepEqual(
    fs.readFileSync(values.ledgerPath),
    values.originalLedgerBytes,
  );
});

test("Stage 1 ledger apply rejects proposal tampering", (t) => {
  const values = fixture(t);
  fs.appendFileSync(values.proposalPath, " ");
  assert.throws(() => applyStage1InviteLedgerProposal(values), /完全一致/);
  assert.deepEqual(
    fs.readFileSync(values.ledgerPath),
    values.originalLedgerBytes,
  );
});

test("Stage 1 ledger apply rejects a changed source ledger", (t) => {
  const values = fixture(t);
  fs.appendFileSync(values.ledgerPath, " ");
  assert.throws(
    () => applyStage1InviteLedgerProposal(values),
    /承認時点と一致しません/,
  );
});

test("Stage 1 ledger apply detects a source change immediately before commit", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      applyStage1InviteLedgerProposal({
        ...values,
        beforeCommit: () => fs.appendFileSync(values.proposalPath, " "),
      }),
    /変更されました/,
  );
  assert.deepEqual(
    fs.readFileSync(values.ledgerPath),
    values.originalLedgerBytes,
  );
});

test("Stage 1 ledger apply refuses a conflicting recovery backup", (t) => {
  const values = fixture(t);
  fs.writeFileSync(values.backupPath, "conflict");
  assert.throws(() => applyStage1InviteLedgerProposal(values), /既存backup/);
  assert.deepEqual(
    fs.readFileSync(values.ledgerPath),
    values.originalLedgerBytes,
  );
});

test("Stage 1 ledger apply finalizes a receipt after commit interruption", (t) => {
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
  assert.deepEqual(
    fs.readFileSync(values.ledgerPath),
    fs.readFileSync(values.proposalPath),
  );
  assert.equal(fs.existsSync(values.appliedReceiptPath), false);
  const recovered = applyStage1InviteLedgerProposal({
    ...values,
    now: new Date("2026-09-16T13:08:00.000Z"),
  });
  assert.equal(recovered.recovered, true);
  const receipt = JSON.parse(
    fs.readFileSync(values.appliedReceiptPath, "utf8"),
  );
  assert.equal(receipt.recoveredAfterCommitInterruption, true);
});

test("Stage 1 ledger apply refuses a second application", (t) => {
  const values = fixture(t);
  applyStage1InviteLedgerProposal(values);
  assert.throws(() => applyStage1InviteLedgerProposal(values), /適用済み/);
});
