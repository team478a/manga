import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { applyInviteLedgerStatusProposal } from "../scripts/adult-pilot-invite-ledger-status-apply.mjs";
import { createInviteLedgerStatusProposal } from "../scripts/adult-pilot-invite-ledger-status-proposal.mjs";
import { auditAdultPilotStage1Lifecycle } from "../scripts/adult-pilot-stage1-lifecycle-audit.mjs";
import { applyStage1InviteLedgerProposal } from "../scripts/adult-pilot-stage1-invite-ledger-apply.mjs";
import { createStage1InviteLedgerProposal } from "../scripts/adult-pilot-stage1-invite-ledger-proposal.mjs";

const auditScript = fileURLToPath(
  new URL("../scripts/adult-pilot-stage1-lifecycle-audit.mjs", import.meta.url),
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

const fixture = (t, { includeOtherMonitor = false } = {}) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-stage1-lifecycle-audit-"),
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
  const entries = includeOtherMonitor
    ? [
        {
          monitorId: "monitor-fedcba543210",
          stage: 2,
          status: "INVITED",
          desktopVersion: "0.1.0-beta.1",
          environment: { windows: "windows_11", vramBand: "16gb_or_more" },
          distributedAt: "2026-09-15T10:00:00.000Z",
          consentedAt: null,
          stoppedAt: null,
        },
      ]
    : [];
  const ledgerPath = write(path.join(privateRoot, "ledger.json"), {
    format: "mangai.desktop-adult-pilot-invite-ledger",
    version: 1,
    entries,
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
    statusProposalPaths: [],
    now: new Date("2026-09-16T12:30:00.000Z"),
  };
};

const applyInvite = (values) =>
  applyStage1InviteLedgerProposal({
    ...values,
    now: new Date("2026-09-16T12:07:00.000Z"),
    confirmProposalReviewed: true,
    confirmRecoveryBackup: true,
    confirmLedgerApply: true,
  });

const createTransition = (
  values,
  name,
  monitorId,
  targetStatus,
  occurredAt,
  createdAt,
) => {
  const proposalPath = path.join(values.privateRoot, `${name}.json`);
  createInviteLedgerStatusProposal({
    repositoryRoot: values.repositoryRoot,
    ledgerPath: values.ledgerPath,
    outputPath: proposalPath,
    monitorId,
    targetStatus,
    occurredAt,
    now: new Date(createdAt),
    confirmStatusEvidenceReviewed: true,
    confirmContentRemainedLocal: true,
    confirmConsentRecorded: targetStatus === "ACTIVE",
    confirmCompletionReviewed: targetStatus === "COMPLETED",
  });
  return proposalPath;
};

const applyTransition = (values, proposalPath, now, hooks = {}) =>
  applyInviteLedgerStatusProposal({
    repositoryRoot: values.repositoryRoot,
    ledgerPath: values.ledgerPath,
    proposalPath,
    now: new Date(now),
    confirmProposalReviewed: true,
    confirmRecoveryBackup: true,
    confirmLedgerApply: true,
    ...hooks,
  });

test("lifecycle audit reports the initial invitation proposal without writes", (t) => {
  const values = fixture(t);
  const before = directorySnapshot(values.privateRoot);
  assert.deepEqual(auditAdultPilotStage1Lifecycle(values), {
    phase: "INITIAL_INVITATION",
    state: "PROPOSAL_READY",
    currentStatus: "NOT_INVITED",
    statusTransitionCount: 0,
  });
  assert.deepEqual(directorySnapshot(values.privateRoot), before);
});

test("lifecycle audit reports an applied invitation as INVITED", (t) => {
  const values = fixture(t);
  applyInvite(values);
  assert.deepEqual(auditAdultPilotStage1Lifecycle(values), {
    phase: "INITIAL_INVITATION",
    state: "APPLIED",
    currentStatus: "INVITED",
    statusTransitionCount: 0,
  });
});

test("lifecycle audit links an applied invitation to a ready status proposal", (t) => {
  const values = fixture(t);
  applyInvite(values);
  const active = createTransition(
    values,
    "active",
    "monitor-012345abcdef",
    "ACTIVE",
    "2026-09-16T12:10:00.000Z",
    "2026-09-16T12:11:00.000Z",
  );
  assert.deepEqual(
    auditAdultPilotStage1Lifecycle({
      ...values,
      statusProposalPaths: [active],
    }),
    {
      phase: "STATUS_TRANSITION",
      state: "PROPOSAL_READY",
      currentStatus: "INVITED",
      statusTransitionCount: 1,
    },
  );
});

test("lifecycle audit validates multiple applied transitions in order", (t) => {
  const values = fixture(t);
  applyInvite(values);
  const active = createTransition(
    values,
    "active",
    "monitor-012345abcdef",
    "ACTIVE",
    "2026-09-16T12:10:00.000Z",
    "2026-09-16T12:11:00.000Z",
  );
  applyTransition(values, active, "2026-09-16T12:12:00.000Z");
  const completed = createTransition(
    values,
    "completed",
    "monitor-012345abcdef",
    "COMPLETED",
    "2026-09-16T12:20:00.000Z",
    "2026-09-16T12:21:00.000Z",
  );
  applyTransition(values, completed, "2026-09-16T12:22:00.000Z");
  const before = directorySnapshot(values.privateRoot);
  assert.deepEqual(
    auditAdultPilotStage1Lifecycle({
      ...values,
      statusProposalPaths: [active, completed],
    }),
    {
      phase: "STATUS_TRANSITION",
      state: "APPLIED",
      currentStatus: "COMPLETED",
      statusTransitionCount: 2,
    },
  );
  assert.deepEqual(directorySnapshot(values.privateRoot), before);
});

test("lifecycle audit reports prepared and recovery-required final transitions", (t) => {
  const prepared = fixture(t);
  applyInvite(prepared);
  const preparedProposal = createTransition(
    prepared,
    "prepared-active",
    "monitor-012345abcdef",
    "ACTIVE",
    "2026-09-16T12:10:00.000Z",
    "2026-09-16T12:11:00.000Z",
  );
  assert.throws(
    () =>
      applyTransition(prepared, preparedProposal, "2026-09-16T12:12:00.000Z", {
        beforeCommit: () => {
          throw new Error("simulated interruption");
        },
      }),
    /simulated interruption/,
  );
  assert.deepEqual(
    auditAdultPilotStage1Lifecycle({
      ...prepared,
      statusProposalPaths: [preparedProposal],
    }),
    {
      phase: "STATUS_TRANSITION",
      state: "APPLY_PREPARED",
      currentStatus: "INVITED",
      statusTransitionCount: 1,
    },
  );

  const recovery = fixture(t);
  applyInvite(recovery);
  const recoveryProposal = createTransition(
    recovery,
    "recovery-active",
    "monitor-012345abcdef",
    "ACTIVE",
    "2026-09-16T12:10:00.000Z",
    "2026-09-16T12:11:00.000Z",
  );
  assert.throws(
    () =>
      applyTransition(recovery, recoveryProposal, "2026-09-16T12:12:00.000Z", {
        afterLedgerCommit: () => {
          throw new Error("simulated interruption");
        },
      }),
    /simulated interruption/,
  );
  assert.deepEqual(
    auditAdultPilotStage1Lifecycle({
      ...recovery,
      statusProposalPaths: [recoveryProposal],
    }),
    {
      phase: "STATUS_TRANSITION",
      state: "RECOVERY_REQUIRED",
      currentStatus: "ACTIVE",
      statusTransitionCount: 1,
    },
  );
});

test("lifecycle audit rejects a missing middle transition", (t) => {
  const values = fixture(t);
  applyInvite(values);
  const active = createTransition(
    values,
    "active",
    "monitor-012345abcdef",
    "ACTIVE",
    "2026-09-16T12:10:00.000Z",
    "2026-09-16T12:11:00.000Z",
  );
  applyTransition(values, active, "2026-09-16T12:12:00.000Z");
  const completed = createTransition(
    values,
    "completed",
    "monitor-012345abcdef",
    "COMPLETED",
    "2026-09-16T12:20:00.000Z",
    "2026-09-16T12:21:00.000Z",
  );
  assert.throws(
    () =>
      auditAdultPilotStage1Lifecycle({
        ...values,
        statusProposalPaths: [completed],
      }),
    /連続していません/,
  );
});

test("lifecycle audit rejects a transition for another monitor", (t) => {
  const values = fixture(t, { includeOtherMonitor: true });
  applyInvite(values);
  const other = createTransition(
    values,
    "other-active",
    "monitor-fedcba543210",
    "ACTIVE",
    "2026-09-16T12:10:00.000Z",
    "2026-09-16T12:11:00.000Z",
  );
  assert.throws(
    () =>
      auditAdultPilotStage1Lifecycle({
        ...values,
        statusProposalPaths: [other],
      }),
    /対象が初回招待と一致しません/,
  );
});

test("lifecycle audit rejects duplicate proposals and concurrent ledger change", (t) => {
  const duplicate = fixture(t);
  applyInvite(duplicate);
  const active = createTransition(
    duplicate,
    "active",
    "monitor-012345abcdef",
    "ACTIVE",
    "2026-09-16T12:10:00.000Z",
    "2026-09-16T12:11:00.000Z",
  );
  assert.throws(
    () =>
      auditAdultPilotStage1Lifecycle({
        ...duplicate,
        statusProposalPaths: [active, active],
      }),
    /複数回指定/,
  );

  const changed = fixture(t);
  assert.throws(
    () =>
      auditAdultPilotStage1Lifecycle({
        ...changed,
        beforeFinalVerification: () =>
          fs.appendFileSync(changed.ledgerPath, " "),
      }),
    /監査中に変更/,
  );
});

test("lifecycle audit CLI hides identities and private paths", (t) => {
  const values = fixture(t);
  applyInvite(values);
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
  assert.match(result.stdout, /Current status: INVITED/);
  assert.match(result.stdout, /Files changed: no/);
  assert.doesNotMatch(
    result.stdout,
    /candidate-|monitor-|authorization\.json|assessment\.json|ledger\.json/i,
  );
});
