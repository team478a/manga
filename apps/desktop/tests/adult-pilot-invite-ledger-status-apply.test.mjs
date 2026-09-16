import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { applyInviteLedgerStatusProposal } from "../scripts/adult-pilot-invite-ledger-status-apply.mjs";
import { createInviteLedgerStatusProposal } from "../scripts/adult-pilot-invite-ledger-status-proposal.mjs";

const write = (target, value) => {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
};

const fixture = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-status-apply-"));
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
        environment: { windows: "windows_11", vramBand: "16gb_or_more" },
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

test("status apply atomically replaces the ledger and preserves recovery evidence", (t) => {
  const values = fixture(t);
  const result = applyInviteLedgerStatusProposal(values);
  const proposal = JSON.parse(fs.readFileSync(values.proposalPath, "utf8"));
  assert.equal(result.recovered, false);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(values.ledgerPath, "utf8")),
    proposal.updatedLedger,
  );
  assert.deepEqual(
    fs.readFileSync(values.backupPath),
    values.originalLedgerBytes,
  );
  const intent = JSON.parse(fs.readFileSync(values.intentPath, "utf8"));
  const receipt = JSON.parse(
    fs.readFileSync(values.appliedReceiptPath, "utf8"),
  );
  assert.equal(intent.statusLedgerApplyAuthorized, true);
  assert.equal(receipt.result, "APPLIED");
  assert.equal(receipt.recoveredAfterCommitInterruption, false);
  for (const target of [values.intentPath, values.appliedReceiptPath])
    assert.doesNotMatch(
      fs.readFileSync(target, "utf8"),
      /monitor-|@|private|ledger\.json/i,
    );
});

test("status apply requires all explicit confirmations", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      applyInviteLedgerStatusProposal({
        ...values,
        confirmRecoveryBackup: false,
      }),
    /明示確認/,
  );
  assert.deepEqual(
    fs.readFileSync(values.ledgerPath),
    values.originalLedgerBytes,
  );
});

test("status apply rejects proposal tampering and unrelated entry changes", (t) => {
  const values = fixture(t);
  const proposal = JSON.parse(fs.readFileSync(values.proposalPath, "utf8"));
  proposal.updatedLedger.entries[1].stage = 3;
  write(values.proposalPath, proposal);
  assert.throws(() => applyInviteLedgerStatusProposal(values), /対象entry以外/);
  assert.deepEqual(
    fs.readFileSync(values.ledgerPath),
    values.originalLedgerBytes,
  );
});

test("status apply rejects a changed source ledger", (t) => {
  const values = fixture(t);
  fs.appendFileSync(values.ledgerPath, " ");
  assert.throws(
    () => applyInviteLedgerStatusProposal(values),
    /現在の招待台帳と一致しません/,
  );
});

test("status apply detects source changes immediately before commit", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      applyInviteLedgerStatusProposal({
        ...values,
        beforeCommit: () => fs.appendFileSync(values.proposalPath, " "),
      }),
    /適用中に変更/,
  );
  assert.deepEqual(
    fs.readFileSync(values.ledgerPath),
    values.originalLedgerBytes,
  );
});

test("status apply refuses conflicting backup and intent evidence", (t) => {
  const backupConflict = fixture(t);
  fs.writeFileSync(backupConflict.backupPath, "conflict");
  assert.throws(
    () => applyInviteLedgerStatusProposal(backupConflict),
    /既存backup/,
  );

  const intentConflict = fixture(t);
  write(intentConflict.intentPath, {
    format: "mangai.desktop-adult-pilot-ledger-status-apply-intent",
    version: 1,
  });
  assert.throws(
    () => applyInviteLedgerStatusProposal(intentConflict),
    /field構成/,
  );
});

test("status apply finalizes only the receipt after commit interruption", (t) => {
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
  const committedBytes = fs.readFileSync(values.ledgerPath);
  assert.equal(fs.existsSync(values.appliedReceiptPath), false);
  const recovered = applyInviteLedgerStatusProposal({
    ...values,
    now: new Date("2026-09-16T11:07:00.000Z"),
  });
  assert.equal(recovered.recovered, true);
  assert.deepEqual(fs.readFileSync(values.ledgerPath), committedBytes);
  const receipt = JSON.parse(
    fs.readFileSync(values.appliedReceiptPath, "utf8"),
  );
  assert.equal(receipt.recoveredAfterCommitInterruption, true);
});

test("status apply refuses a second application", (t) => {
  const values = fixture(t);
  applyInviteLedgerStatusProposal(values);
  assert.throws(() => applyInviteLedgerStatusProposal(values), /適用済み/);
});

test("status apply requires private local paths", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      applyInviteLedgerStatusProposal({
        ...values,
        proposalPath: path.join(values.repositoryRoot, "proposal.json"),
      }),
    /Git管理外/,
  );
});
