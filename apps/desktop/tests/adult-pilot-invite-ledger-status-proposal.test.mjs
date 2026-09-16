import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createInviteLedgerStatusProposal,
  validateStatusProposal,
} from "../scripts/adult-pilot-invite-ledger-status-proposal.mjs";

const write = (target, value) => {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
};

const fixture = (t, status = "INVITED") => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-ledger-status-"));
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
        status,
        desktopVersion: "0.1.0-beta.1",
        environment: { windows: "windows_11", vramBand: "12gb" },
        distributedAt: "2026-09-16T10:00:00.000Z",
        consentedAt: status === "INVITED" ? null : "2026-09-16T10:30:00.000Z",
        stoppedAt: status === "STOPPED" ? "2026-09-16T11:00:00.000Z" : null,
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
  return {
    repositoryRoot,
    privateRoot,
    ledgerPath,
    outputPath: path.join(privateRoot, "status-proposal.json"),
    monitorId: "monitor-012345abcdef",
    occurredAt: "2026-09-16T11:00:00.000Z",
    now: new Date("2026-09-16T11:05:00.000Z"),
    confirmStatusEvidenceReviewed: true,
    confirmContentRemainedLocal: true,
  };
};

test("status proposal activates an invited monitor without changing the source ledger", (t) => {
  const values = fixture(t);
  const original = fs.readFileSync(values.ledgerPath);
  const { proposal } = createInviteLedgerStatusProposal({
    ...values,
    targetStatus: "ACTIVE",
    confirmConsentRecorded: true,
  });
  assert.equal(proposal.sourceStatus, "INVITED");
  assert.equal(proposal.targetStatus, "ACTIVE");
  assert.equal(proposal.evidence, "CONSENT_CONFIRMED");
  assert.equal(proposal.updatedLedger.entries[0].status, "ACTIVE");
  assert.equal(
    proposal.updatedLedger.entries[0].consentedAt,
    values.occurredAt,
  );
  assert.deepEqual(fs.readFileSync(values.ledgerPath), original);
  validateStatusProposal(
    JSON.parse(fs.readFileSync(values.outputPath, "utf8")),
  );
});

test("status proposal supports every allowed terminal transition", (t) => {
  for (const [targetStatus, flag] of [
    ["STOPPED", "confirmStopActionRecorded"],
    ["COMPLETED", "confirmCompletionReviewed"],
    ["WITHDRAWN", "confirmWithdrawalRecorded"],
  ]) {
    const values = fixture(t, "ACTIVE");
    createInviteLedgerStatusProposal({ ...values, targetStatus, [flag]: true });
    const proposal = JSON.parse(fs.readFileSync(values.outputPath, "utf8"));
    assert.equal(proposal.updatedLedger.entries[0].status, targetStatus);
    assert.equal(proposal.occurredAt, values.occurredAt);
    assert.equal(
      proposal.updatedLedger.entries[0].stoppedAt,
      targetStatus === "STOPPED" ? values.occurredAt : null,
    );
  }
});

test("status proposal allows withdrawal before activation", (t) => {
  const values = fixture(t);
  const { proposal } = createInviteLedgerStatusProposal({
    ...values,
    targetStatus: "WITHDRAWN",
    confirmWithdrawalRecorded: true,
  });
  assert.equal(proposal.updatedLedger.entries[0].status, "WITHDRAWN");
  assert.equal(proposal.updatedLedger.entries[0].consentedAt, null);
});

test("status proposal rejects unapproved and terminal-state transitions", (t) => {
  const invited = fixture(t);
  assert.throws(
    () =>
      createInviteLedgerStatusProposal({
        ...invited,
        targetStatus: "COMPLETED",
        confirmCompletionReviewed: true,
      }),
    /許可されていない/,
  );
  const terminal = fixture(t, "STOPPED");
  assert.throws(
    () =>
      createInviteLedgerStatusProposal({
        ...terminal,
        targetStatus: "ACTIVE",
        confirmConsentRecorded: true,
      }),
    /許可されていない/,
  );
});

test("status proposal requires common and target-specific confirmations", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      createInviteLedgerStatusProposal({
        ...values,
        targetStatus: "ACTIVE",
        confirmConsentRecorded: false,
      }),
    /明示確認/,
  );
  assert.equal(fs.existsSync(values.outputPath), false);
});

test("status proposal rejects future and out-of-order timestamps", (t) => {
  const future = fixture(t);
  assert.throws(
    () =>
      createInviteLedgerStatusProposal({
        ...future,
        targetStatus: "ACTIVE",
        occurredAt: "2026-09-16T11:06:00.000Z",
        confirmConsentRecorded: true,
      }),
    /時系列/,
  );
  const beforeConsent = fixture(t, "ACTIVE");
  assert.throws(
    () =>
      createInviteLedgerStatusProposal({
        ...beforeConsent,
        targetStatus: "STOPPED",
        occurredAt: "2026-09-16T10:29:00.000Z",
        confirmStopActionRecorded: true,
      }),
    /同意日時より前/,
  );
});

test("status proposal requires private paths, a known monitor, and a new output", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      createInviteLedgerStatusProposal({
        ...values,
        monitorId: "monitor-aaaaaaaaaaaa",
        targetStatus: "ACTIVE",
        confirmConsentRecorded: true,
      }),
    /存在しません/,
  );
  write(values.outputPath, {});
  assert.throws(
    () =>
      createInviteLedgerStatusProposal({
        ...values,
        targetStatus: "ACTIVE",
        confirmConsentRecorded: true,
      }),
    /EEXIST/,
  );
  assert.throws(
    () =>
      createInviteLedgerStatusProposal({
        ...values,
        outputPath: path.join(values.repositoryRoot, "proposal.json"),
        targetStatus: "ACTIVE",
        confirmConsentRecorded: true,
      }),
    /Git管理外/,
  );
});

test("status proposal rejects concurrent source changes and private data", (t) => {
  const changed = fixture(t);
  assert.throws(
    () =>
      createInviteLedgerStatusProposal({
        ...changed,
        targetStatus: "ACTIVE",
        confirmConsentRecorded: true,
        beforeWrite: () => fs.appendFileSync(changed.ledgerPath, " "),
      }),
    /作成中に変更/,
  );
  const privateData = fixture(t);
  const ledger = JSON.parse(fs.readFileSync(privateData.ledgerPath, "utf8"));
  ledger.entries[0].email = "monitor@example.com";
  write(privateData.ledgerPath, ledger);
  assert.throws(
    () =>
      createInviteLedgerStatusProposal({
        ...privateData,
        targetStatus: "ACTIVE",
        confirmConsentRecorded: true,
      }),
    /保存禁止field/,
  );
});
