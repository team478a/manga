import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  readStage1LedgerApplySnapshot,
  stage1LedgerApplyDerivedPaths,
  validateStage1LedgerApplyIntent,
} from "./adult-pilot-stage1-invite-ledger-apply.mjs";
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

const validateAppliedReceipt = (receipt, snapshot, intent, now) => {
  exactKeys(
    receipt,
    [
      "format",
      "version",
      "appliedAt",
      "authorizationSha256",
      "sourceLedgerSha256",
      "proposalSha256",
      "appliedLedgerSha256",
      "stage",
      "recoveredAfterCommitInterruption",
      "result",
    ],
    "招待台帳適用receipt",
  );
  if (
    receipt.format !== "mangai.desktop-adult-stage1-ledger-applied-receipt" ||
    receipt.version !== 1 ||
    !isTimestamp(receipt.appliedAt) ||
    !sha256Pattern.test(receipt.authorizationSha256 ?? "") ||
    receipt.authorizationSha256 !== snapshot.authorizationSha256 ||
    receipt.sourceLedgerSha256 !== snapshot.sourceLedgerSha256 ||
    receipt.proposalSha256 !== snapshot.proposalSha256 ||
    receipt.appliedLedgerSha256 !== snapshot.proposalSha256 ||
    receipt.stage !== 1 ||
    typeof receipt.recoveredAfterCommitInterruption !== "boolean" ||
    receipt.result !== "APPLIED" ||
    Date.parse(receipt.appliedAt) < Date.parse(intent.preparedAt) ||
    Date.parse(receipt.appliedAt) < Date.parse(snapshot.receipt.consumedAt) ||
    Date.parse(receipt.appliedAt) > now.getTime()
  )
    throw new Error("招待台帳適用receiptが承認済みproposalと一致しません。");
  return receipt;
};

const assertPaths = (options) => {
  for (const [target, label] of [
    [options.authorizationPath, "Stage 1招待承認"],
    [options.assessmentPath, "候補assessment"],
    [options.ledgerPath, "招待台帳"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  const paths = stage1LedgerApplyDerivedPaths(
    options.authorizationPath,
    options.ledgerPath,
  );
  for (const [target, label] of [
    [paths.consumedReceiptPath, "Stage 1招待承認receipt"],
    [paths.proposalPath, "招待台帳proposal"],
    [paths.backupPath, "招待台帳backup"],
    [paths.intentPath, "招待台帳適用intent"],
    [paths.appliedReceiptPath, "招待台帳適用receipt"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  return paths;
};

const addSnapshotSources = (observed, options, snapshot, sourcePath) => {
  observed.push(
    [options.authorizationPath, "Stage 1招待承認", snapshot.authorizationBytes],
    [
      snapshot.paths.consumedReceiptPath,
      "Stage 1招待承認receipt",
      snapshot.consumedReceiptBytes,
    ],
    [options.assessmentPath, "候補assessment", snapshot.assessmentBytes],
    [sourcePath, "適用前招待台帳", snapshot.sourceLedgerBytes],
    [snapshot.paths.proposalPath, "招待台帳proposal", snapshot.proposalBytes],
  );
};

const verifyUnchanged = (observed) => {
  for (const [target, label, bytes] of observed)
    if (!readFile(target, label).equals(bytes))
      throw new Error(`${label}が監査中に変更されました。`);
};

const verifyEvidencePresence = (presence) => {
  for (const [target, existed] of presence)
    if (fs.existsSync(target) !== existed)
      throw new Error("招待台帳適用証跡が監査中に変更されました。");
};

export const auditStage1InviteLedgerProposal = (rawOptions) => {
  const options = {
    ...rawOptions,
    repositoryRoot: rawOptions.repositoryRoot ?? defaultRepositoryRoot,
    now: rawOptions.now ?? new Date(),
  };
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("招待台帳監査日時が不正です。");
  const paths = assertPaths(options);
  const ledgerBytes = readFile(options.ledgerPath, "招待台帳");
  const proposalBytes = readFile(paths.proposalPath, "招待台帳proposal");
  const observed = [
    [options.ledgerPath, "招待台帳", ledgerBytes],
    [paths.proposalPath, "招待台帳proposal", proposalBytes],
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
    if (ledgerBytes.equals(proposalBytes))
      throw new Error("適用済み台帳に回復証跡がありません。");
    const snapshot = readStage1LedgerApplySnapshot(
      options,
      ledgerBytes,
      options.now,
    );
    if (!snapshot.proposalBytes.equals(proposalBytes))
      throw new Error("招待台帳proposalが監査中に変更されました。");
    addSnapshotSources(observed, options, snapshot, options.ledgerPath);
    verifyUnchanged(observed);
    verifyEvidencePresence(evidencePresence);
    return { state: "PROPOSAL_READY", stage: 1 };
  }

  if (!backupExists || !intentExists)
    throw new Error("招待台帳適用証跡が不完全です。");
  const backupBytes = readFile(paths.backupPath, "招待台帳backup");
  const intentBytes = readFile(paths.intentPath, "招待台帳適用intent");
  const intentValue = readJson(intentBytes, "招待台帳適用intent");
  if (!isTimestamp(intentValue.preparedAt))
    throw new Error("招待台帳適用intentの準備日時が不正です。");
  observed.push(
    [paths.backupPath, "招待台帳backup", backupBytes],
    [paths.intentPath, "招待台帳適用intent", intentBytes],
  );
  const snapshot = readStage1LedgerApplySnapshot(
    options,
    backupBytes,
    new Date(intentValue.preparedAt),
  );
  if (!snapshot.proposalBytes.equals(proposalBytes))
    throw new Error("招待台帳proposalが監査中に変更されました。");
  const intent = validateStage1LedgerApplyIntent(intentValue, snapshot);
  addSnapshotSources(observed, options, snapshot, paths.backupPath);
  const ledgerIsSource = ledgerBytes.equals(snapshot.sourceLedgerBytes);
  const ledgerIsTarget = ledgerBytes.equals(snapshot.proposalBytes);
  if (!ledgerIsSource && !ledgerIsTarget)
    throw new Error("招待台帳が適用前後のどちらとも一致しません。");

  let state;
  if (receiptExists) {
    if (!ledgerIsTarget)
      throw new Error("適用receiptと現在の招待台帳が一致しません。");
    const receiptBytes = readFile(
      paths.appliedReceiptPath,
      "招待台帳適用receipt",
    );
    observed.push([
      paths.appliedReceiptPath,
      "招待台帳適用receipt",
      receiptBytes,
    ]);
    validateAppliedReceipt(
      readJson(receiptBytes, "招待台帳適用receipt"),
      snapshot,
      intent,
      options.now,
    );
    state = "APPLIED";
  } else state = ledgerIsSource ? "APPLY_PREPARED" : "RECOVERY_REQUIRED";

  verifyUnchanged(observed);
  verifyEvidencePresence(evidencePresence);
  return { state, stage: 1 };
};

const valueFlags = new Set(["--authorization", "--assessment", "--ledger"]);
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
        throw new Error("招待台帳監査の引数が不足しています。");
    const result = auditStage1InviteLedgerProposal({
      authorizationPath: args.get("--authorization"),
      assessmentPath: args.get("--assessment"),
      ledgerPath: args.get("--ledger"),
    });
    console.log("MANGAI Desktop Adult Stage 1 invite ledger audit");
    console.log(`  State: ${result.state}`);
    console.log(`  Stage: ${result.stage}`);
    console.log("  Candidate, monitor ID, and paths: hidden");
    console.log("  Files changed: no");
    console.log("  External action: no");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "招待台帳監査のfile操作に失敗しました。"
        : error.message;
    console.error(`Stage 1 invite ledger audit failed: ${message}`);
    process.exit(1);
  }
}
