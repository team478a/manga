import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { auditInviteLedgerStatusProposal } from "../scripts/adult-pilot-invite-ledger-status-audit.mjs";
import { applyInviteLedgerStatusProposal } from "../scripts/adult-pilot-invite-ledger-status-apply.mjs";
import { createInviteLedgerStatusProposal } from "../scripts/adult-pilot-invite-ledger-status-proposal.mjs";

const auditScript = fileURLToPath(
  new URL(
    "../scripts/adult-pilot-invite-ledger-status-audit.mjs",
    import.meta.url,
  ),
);

const write = (target, value) => {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
};

const directorySnapshot = (root) =>
  Object.fromEntries(
    fs
      .readdirSync(root)
      .sort()
      .map((name) => [
        name,
        crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(root, name)))
          .digest("hex"),
      ]),
  );

const fixture = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-status-audit-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, "repository");
  const privateRoot = path.join(root, "private");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(privateRoot);
  const ledgerPath = write(path.join(privateRoot, "ledger.json"), {
    format: "mangai.desktop-adult-pilot-invite-ledger",
    version: 1,
    entries: [
      {
        monitorId: "monitor-012345abcdef",
        stage: 1,
        status: "INVITED",
        desktopVersion: "0.1.0-beta.1",
        environment: { windows: "windows_11", vramBand: "12gb" },
        distributedAt: "2026-09-16T10:00:00.000Z",
        consentedAt: null,
        stoppedAt: null,
      },
      {
        monitorId: "monitor-fedcba543210",
        stage: 2,
        status: "COMPLETED",
        desktopVersion: "0.1.0-beta.1",
        environment: {
          windows: "windows_11",
          vramBand: "16gb_or_more",
        },
        distributedAt: "2026-09-14T10:00:00.000Z",
        consentedAt: "2026-09-14T10:30:00.000Z",
        stoppedAt: null,
      },
    ],
  });
  const originalLedgerBytes = fs.readFileSync(ledgerPath);
  const proposalPath = path.join(privateRoot, "status-proposal.json");
  createInviteLedgerStatusProposal({
    repositoryRoot,
    ledgerPath,
    outputPath: proposalPath,
    monitorId: "monitor-012345abcdef",
    targetStatus: "ACTIVE",
    occurredAt: "2026-09-16T11:00:00.000Z",
    now: new Date("2026-09-16T11:05:00.000Z"),
    confirmStatusEvidenceReviewed: true,
    confirmContentRemainedLocal: true,
    confirmConsentRecorded: true,
  });
  return {
    repositoryRoot,
    privateRoot,
    ledgerPath,
    proposalPath,
    backupPath: `${proposalPath}.ledger-before-apply.json`,
    intentPath: `${proposalPath}.apply-intent.json`,
    appliedReceiptPath: `${proposalPath}.applied.json`,
    originalLedgerBytes,
    now: new Date("2026-09-16T11:06:00.000Z"),
    confirmProposalReviewed: true,
    confirmRecoveryBackup: true,
    confirmLedgerApply: true,
  };
};

test("status audit reports a ready proposal without changing any file", (t) => {
  const values = fixture(t);
  const before = directorySnapshot(values.privateRoot);
  assert.deepEqual(auditInviteLedgerStatusProposal(values), {
    state: "PROPOSAL_READY",
    sourceStatus: "INVITED",
    targetStatus: "ACTIVE",
  });
  assert.deepEqual(directorySnapshot(values.privateRoot), before);
});

test("status audit reports prepared apply evidence", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      applyInviteLedgerStatusProposal({
        ...values,
        beforeCommit: () => {
          throw new Error("simulated interruption");
        },
      }),
    /simulated interruption/,
  );
  assert.equal(auditInviteLedgerStatusProposal(values).state, "APPLY_PREPARED");
  assert.deepEqual(
    fs.readFileSync(values.ledgerPath),
    values.originalLedgerBytes,
  );
});

test("status audit reports receipt recovery after ledger commit", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      applyInviteLedgerStatusProposal({
        ...values,
        afterLedgerCommit: () => {
          throw new Error("simulated interruption");
        },
      }),
    /simulated interruption/,
  );
  assert.equal(
    auditInviteLedgerStatusProposal(values).state,
    "RECOVERY_REQUIRED",
  );
  assert.equal(fs.existsSync(values.appliedReceiptPath), false);
});

test("status audit validates a completed application without writes", (t) => {
  const values = fixture(t);
  applyInviteLedgerStatusProposal(values);
  const before = directorySnapshot(values.privateRoot);
  assert.equal(auditInviteLedgerStatusProposal(values).state, "APPLIED");
  assert.deepEqual(directorySnapshot(values.privateRoot), before);
});

test("status audit rejects a tampered applied receipt", (t) => {
  const values = fixture(t);
  applyInviteLedgerStatusProposal(values);
  const receipt = JSON.parse(
    fs.readFileSync(values.appliedReceiptPath, "utf8"),
  );
  receipt.appliedLedgerSha256 = "0".repeat(64);
  write(values.appliedReceiptPath, receipt);
  assert.throws(
    () => auditInviteLedgerStatusProposal(values),
    /receiptがproposalと一致しません/,
  );
});

test("status audit rejects incomplete or contradictory evidence", (t) => {
  const incomplete = fixture(t);
  fs.writeFileSync(incomplete.backupPath, incomplete.originalLedgerBytes);
  assert.throws(
    () => auditInviteLedgerStatusProposal(incomplete),
    /証跡が不完全/,
  );

  const contradictory = fixture(t);
  applyInviteLedgerStatusProposal(contradictory);
  fs.writeFileSync(contradictory.ledgerPath, contradictory.originalLedgerBytes);
  assert.throws(
    () => auditInviteLedgerStatusProposal(contradictory),
    /receiptと現在の招待台帳/,
  );
});

test("status audit rejects a target ledger without recovery evidence", (t) => {
  const values = fixture(t);
  const proposal = JSON.parse(fs.readFileSync(values.proposalPath, "utf8"));
  write(values.ledgerPath, proposal.updatedLedger);
  assert.throws(
    () => auditInviteLedgerStatusProposal(values),
    /回復証跡がありません/,
  );
});

test("status audit rejects changed source and proposal data", (t) => {
  const changedSource = fixture(t);
  fs.appendFileSync(changedSource.ledgerPath, " ");
  assert.throws(
    () => auditInviteLedgerStatusProposal(changedSource),
    /現在の招待台帳と一致しません/,
  );

  const changedProposal = fixture(t);
  const proposal = JSON.parse(
    fs.readFileSync(changedProposal.proposalPath, "utf8"),
  );
  proposal.updatedLedger.entries[1].stage = 3;
  write(changedProposal.proposalPath, proposal);
  assert.throws(
    () => auditInviteLedgerStatusProposal(changedProposal),
    /対象entry以外/,
  );
});

test("status audit rejects repository paths", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      auditInviteLedgerStatusProposal({
        ...values,
        repositoryRoot: values.privateRoot,
      }),
    /Git管理外/,
  );
});

test("status audit CLI hides monitor identity and private paths", (t) => {
  const values = fixture(t);
  const result = spawnSync(
    process.execPath,
    [
      auditScript,
      "--ledger",
      values.ledgerPath,
      "--proposal",
      values.proposalPath,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /State: PROPOSAL_READY/);
  assert.match(result.stdout, /Files changed: no/);
  assert.doesNotMatch(result.stdout, /monitor-|status-proposal|ledger\.json/i);
});
