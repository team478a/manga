import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  canonicalStatusBytes,
  readStatusApplySnapshot,
  statusApplyDerivedPaths,
  validateStatusApplyIntent,
} from "./adult-pilot-invite-ledger-status-apply.mjs";
import { validateStatusProposal } from "./adult-pilot-invite-ledger-status-proposal.mjs";
import {
  assertPrivatePath,
  exactKeys,
  isTimestamp,
  readFile,
  readJson,
} from "./adult-pilot-stage1-invite-ledger-proposal.mjs";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const sha256Pattern = /^[a-f0-9]{64}$/;

const validateReceipt = (receipt, snapshot, intent, now) => {
  exactKeys(
    receipt,
    [
      "format",
      "version",
      "appliedAt",
      "sourceLedgerSha256",
      "proposalSha256",
      "appliedLedgerSha256",
      "sourceStatus",
      "targetStatus",
      "recoveredAfterCommitInterruption",
      "result",
    ],
    "状態遷移適用receipt",
  );
  if (
    receipt.format !==
      "mangai.desktop-adult-pilot-ledger-status-applied-receipt" ||
    receipt.version !== 1 ||
    !isTimestamp(receipt.appliedAt) ||
    !sha256Pattern.test(receipt.sourceLedgerSha256 ?? "") ||
    receipt.sourceLedgerSha256 !== snapshot.sourceLedgerSha256 ||
    receipt.proposalSha256 !== snapshot.proposalSha256 ||
    receipt.appliedLedgerSha256 !== snapshot.targetLedgerSha256 ||
    receipt.sourceStatus !== snapshot.proposal.sourceStatus ||
    receipt.targetStatus !== snapshot.proposal.targetStatus ||
    typeof receipt.recoveredAfterCommitInterruption !== "boolean" ||
    receipt.result !== "APPLIED" ||
    Date.parse(receipt.appliedAt) < Date.parse(snapshot.proposal.createdAt) ||
    Date.parse(receipt.appliedAt) < Date.parse(intent.preparedAt) ||
    Date.parse(receipt.appliedAt) > now.getTime()
  )
    throw new Error("状態遷移適用receiptがproposalと一致しません。");
  return receipt;
};

const assertPaths = (options) => {
  for (const [target, label] of [
    [options.ledgerPath, "招待台帳"],
    [options.proposalPath, "状態遷移proposal"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  const paths = statusApplyDerivedPaths(
    options.proposalPath,
    options.ledgerPath,
  );
  for (const [target, label] of [
    [paths.backupPath, "招待台帳backup"],
    [paths.intentPath, "状態遷移適用intent"],
    [paths.appliedReceiptPath, "状態遷移適用receipt"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  return paths;
};

const verifyUnchanged = (observed) => {
  for (const [target, label, bytes] of observed)
    if (!readFile(target, label).equals(bytes))
      throw new Error(`${label}が監査中に変更されました。`);
};

const verifyEvidencePresence = (presence) => {
  for (const [target, existed] of presence)
    if (fs.existsSync(target) !== existed)
      throw new Error("状態遷移適用証跡が監査中に変更されました。");
};

export const auditInviteLedgerStatusProposal = (rawOptions) => {
  const options = {
    ...rawOptions,
    repositoryRoot: rawOptions.repositoryRoot ?? defaultRepositoryRoot,
    now: rawOptions.now ?? new Date(),
  };
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("状態遷移監査日時が不正です。");
  const paths = assertPaths(options);
  const ledgerBytes = readFile(options.ledgerPath, "招待台帳");
  const proposalBytes = readFile(options.proposalPath, "状態遷移proposal");
  const proposal = validateStatusProposal(
    readJson(proposalBytes, "状態遷移proposal"),
  );
  const targetLedgerBytes = canonicalStatusBytes(proposal.updatedLedger);
  const observed = [
    [options.ledgerPath, "招待台帳", ledgerBytes],
    [options.proposalPath, "状態遷移proposal", proposalBytes],
  ];
  const backupExists = fs.existsSync(paths.backupPath);
  const intentExists = fs.existsSync(paths.intentPath);
  const receiptExists = fs.existsSync(paths.appliedReceiptPath);
  const evidencePresence = new Map([
    [paths.backupPath, backupExists],
    [paths.intentPath, intentExists],
    [paths.appliedReceiptPath, receiptExists],
  ]);

  if (!backupExists && !intentExists && !receiptExists) {
    if (ledgerBytes.equals(targetLedgerBytes))
      throw new Error("適用済み台帳に回復証跡がありません。");
    const snapshot = readStatusApplySnapshot(options, ledgerBytes);
    if (!snapshot.proposalBytes.equals(proposalBytes))
      throw new Error("状態遷移proposalが監査中に変更されました。");
    verifyUnchanged(observed);
    verifyEvidencePresence(evidencePresence);
    return {
      state: "PROPOSAL_READY",
      sourceStatus: proposal.sourceStatus,
      targetStatus: proposal.targetStatus,
    };
  }

  if (!backupExists || !intentExists)
    throw new Error("状態遷移適用証跡が不完全です。");
  const backupBytes = readFile(paths.backupPath, "招待台帳backup");
  const intentBytes = readFile(paths.intentPath, "状態遷移適用intent");
  observed.push(
    [paths.backupPath, "招待台帳backup", backupBytes],
    [paths.intentPath, "状態遷移適用intent", intentBytes],
  );
  const snapshot = readStatusApplySnapshot(options, backupBytes);
  if (!snapshot.proposalBytes.equals(proposalBytes))
    throw new Error("状態遷移proposalが監査中に変更されました。");
  const intent = validateStatusApplyIntent(
    readJson(intentBytes, "状態遷移適用intent"),
    snapshot,
  );
  const ledgerIsSource = ledgerBytes.equals(snapshot.sourceLedgerBytes);
  const ledgerIsTarget = ledgerBytes.equals(snapshot.targetLedgerBytes);
  if (!ledgerIsSource && !ledgerIsTarget)
    throw new Error("招待台帳が適用前後のどちらとも一致しません。");

  let state;
  if (receiptExists) {
    if (!ledgerIsTarget)
      throw new Error("適用receiptと現在の招待台帳が一致しません。");
    const receiptBytes = readFile(
      paths.appliedReceiptPath,
      "状態遷移適用receipt",
    );
    observed.push([
      paths.appliedReceiptPath,
      "状態遷移適用receipt",
      receiptBytes,
    ]);
    validateReceipt(
      readJson(receiptBytes, "状態遷移適用receipt"),
      snapshot,
      intent,
      options.now,
    );
    state = "APPLIED";
  } else state = ledgerIsSource ? "APPLY_PREPARED" : "RECOVERY_REQUIRED";

  verifyUnchanged(observed);
  verifyEvidencePresence(evidencePresence);
  return {
    state,
    sourceStatus: proposal.sourceStatus,
    targetStatus: proposal.targetStatus,
  };
};

const valueFlags = new Set(["--ledger", "--proposal"]);
const parseArgs = (args) => {
  const parsed = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!valueFlags.has(argument)) throw new Error("未対応の引数があります。");
    if (parsed.has(argument))
      throw new Error("同じ引数を複数回指定できません。");
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error("値が必要な引数があります。");
    parsed.set(argument, value);
    index += 1;
  }
  return parsed;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const args = parseArgs(process.argv.slice(2));
    for (const flag of valueFlags)
      if (!args.has(flag))
        throw new Error("状態遷移監査の引数が不足しています。");
    const result = auditInviteLedgerStatusProposal({
      ledgerPath: args.get("--ledger"),
      proposalPath: args.get("--proposal"),
    });
    console.log("MANGAI Desktop Adult pilot ledger status audit");
    console.log(`  State: ${result.state}`);
    console.log(
      `  Transition: ${result.sourceStatus} -> ${result.targetStatus}`,
    );
    console.log("  Monitor ID and paths: hidden");
    console.log("  Files changed: no");
    console.log("  External action: no");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "状態遷移監査のfile操作に失敗しました。"
        : error.message;
    console.error(`Adult pilot ledger status audit failed: ${message}`);
    process.exit(1);
  }
}
