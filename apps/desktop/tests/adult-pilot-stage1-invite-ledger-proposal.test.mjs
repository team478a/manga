import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

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
    path.join(os.tmpdir(), "mangai-stage1-ledger-proposal-"),
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
  const receiptPath = `${authorizationPath}.consumed.json`;
  write(receiptPath, {
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
  return {
    repositoryRoot,
    privateRoot,
    assessmentPath,
    ledgerPath,
    authorizationPath,
    receiptPath,
    proposalPath: `${authorizationPath}.ledger-proposal.json`,
    distributedAt: "2026-09-16T12:05:00.000Z",
    now: new Date("2026-09-16T12:06:00.000Z"),
    confirmManualDistributionCompleted: true,
    confirmRecipientMatched: true,
    confirmStopContactShared: true,
    confirmContentRemainedLocal: true,
  };
};

const rebindLedger = (values, ledger) => {
  write(values.ledgerPath, ledger);
  const authorization = JSON.parse(
    fs.readFileSync(values.authorizationPath, "utf8"),
  );
  authorization.sources.ledger = sourceBinding(values.ledgerPath);
  write(values.authorizationPath, authorization);
  const receipt = JSON.parse(fs.readFileSync(values.receiptPath, "utf8"));
  receipt.authorizationSha256 = digest(
    fs.readFileSync(values.authorizationPath),
  );
  write(values.receiptPath, receipt);
};

test("Stage 1 invite ledger proposal creates a valid separate ledger without private data", (t) => {
  const values = fixture(t);
  const originalLedger = fs.readFileSync(values.ledgerPath);
  const { proposal, proposalPath } = createStage1InviteLedgerProposal(values);
  assert.equal(proposalPath, values.proposalPath);
  assert.equal(proposal.entries.length, 1);
  assert.deepEqual(proposal.entries[0], {
    monitorId: "monitor-012345abcdef",
    stage: 1,
    status: "INVITED",
    desktopVersion: "0.1.0-beta.1",
    environment: { windows: "windows_11", vramBand: "12gb" },
    distributedAt: values.distributedAt,
    consentedAt: null,
    stoppedAt: null,
  });
  assert.deepEqual(fs.readFileSync(values.ledgerPath), originalLedger);
  const serialized = fs.readFileSync(proposalPath, "utf8");
  assert.doesNotMatch(serialized, /candidate-|@|authorization\.json|private/i);
});

test("Stage 1 invite ledger proposal requires every post-distribution confirmation", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      createStage1InviteLedgerProposal({
        ...values,
        confirmStopContactShared: false,
      }),
    /明示確認/,
  );
  assert.equal(fs.existsSync(values.proposalPath), false);
});

test("Stage 1 invite ledger proposal requires an unchanged bound assessment and ledger", (t) => {
  const changedLedger = fixture(t);
  fs.appendFileSync(changedLedger.ledgerPath, " ");
  assert.throws(
    () => createStage1InviteLedgerProposal(changedLedger),
    /承認時点と一致しません/,
  );

  const changedAssessment = fixture(t);
  fs.appendFileSync(changedAssessment.assessmentPath, " ");
  assert.throws(
    () => createStage1InviteLedgerProposal(changedAssessment),
    /承認時点と一致しません/,
  );
});

test("Stage 1 invite ledger proposal rejects copied authorization and tampered receipt", (t) => {
  const copied = fixture(t);
  const copiedAuthorizationPath = path.join(
    copied.privateRoot,
    "copied-authorization.json",
  );
  fs.copyFileSync(copied.authorizationPath, copiedAuthorizationPath);
  fs.copyFileSync(
    copied.receiptPath,
    `${copiedAuthorizationPath}.consumed.json`,
  );
  assert.throws(
    () =>
      createStage1InviteLedgerProposal({
        ...copied,
        authorizationPath: copiedAuthorizationPath,
      }),
    /安全境界/,
  );

  const tampered = fixture(t);
  const receipt = JSON.parse(fs.readFileSync(tampered.receiptPath, "utf8"));
  receipt.monitorId = "monitor-fedcba654321";
  write(tampered.receiptPath, receipt);
  assert.throws(
    () => createStage1InviteLedgerProposal(tampered),
    /承認内容と一致しません/,
  );
});

test("Stage 1 invite ledger proposal enforces consumed, distributed, and expiry order", (t) => {
  const beforeConsume = fixture(t);
  beforeConsume.distributedAt = "2026-09-16T12:00:30.000Z";
  assert.throws(
    () => createStage1InviteLedgerProposal(beforeConsume),
    /有効期間と一致しません/,
  );

  const future = fixture(t);
  future.distributedAt = "2026-09-16T12:07:00.000Z";
  assert.throws(
    () => createStage1InviteLedgerProposal(future),
    /有効期間と一致しません/,
  );

  const expired = fixture(t);
  expired.now = new Date("2026-09-16T13:00:00.000Z");
  assert.throws(
    () => createStage1InviteLedgerProposal(expired),
    /有効期間と一致しません/,
  );
});

test("Stage 1 invite ledger proposal rejects private ledger data", (t) => {
  const values = fixture(t);
  const ledger = {
    format: "mangai.desktop-adult-pilot-invite-ledger",
    version: 1,
    entries: [],
    email: "person@example.com",
  };
  rebindLedger(values, ledger);
  assert.throws(
    () => createStage1InviteLedgerProposal(values),
    /保存禁止|個人情報/,
  );
});

test("Stage 1 invite ledger proposal rejects duplicate monitor and live Stage 1", (t) => {
  const duplicate = fixture(t);
  rebindLedger(duplicate, {
    format: "mangai.desktop-adult-pilot-invite-ledger",
    version: 1,
    entries: [
      {
        monitorId: "monitor-012345abcdef",
        stage: 2,
        status: "COMPLETED",
        desktopVersion: "0.1.0-beta.1",
        environment: { windows: "windows_11", vramBand: "12gb" },
        distributedAt: "2026-09-15T10:00:00.000Z",
        consentedAt: "2026-09-15T10:05:00.000Z",
        stoppedAt: null,
      },
    ],
  });
  assert.throws(
    () => createStage1InviteLedgerProposal(duplicate),
    /同じmonitor ID/,
  );

  const live = fixture(t);
  rebindLedger(live, {
    format: "mangai.desktop-adult-pilot-invite-ledger",
    version: 1,
    entries: [
      {
        monitorId: "monitor-fedcba654321",
        stage: 1,
        status: "ACTIVE",
        desktopVersion: "0.1.0-beta.1",
        environment: { windows: "windows_11", vramBand: "12gb" },
        distributedAt: "2026-09-15T10:00:00.000Z",
        consentedAt: "2026-09-15T10:05:00.000Z",
        stoppedAt: null,
      },
    ],
  });
  assert.throws(() => createStage1InviteLedgerProposal(live), /進行中の招待/);
});

test("Stage 1 invite ledger proposal refuses overwrite", (t) => {
  const values = fixture(t);
  fs.writeFileSync(values.proposalPath, "existing");
  assert.throws(() => createStage1InviteLedgerProposal(values), /EEXIST/);
});
