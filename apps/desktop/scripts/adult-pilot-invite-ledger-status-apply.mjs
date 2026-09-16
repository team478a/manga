import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validateStatusProposal } from "./adult-pilot-invite-ledger-status-proposal.mjs";
import {
  assertPrivatePath,
  digest,
  exactKeys,
  isTimestamp,
  readFile,
  readJson,
  sourceBinding,
  validateLedger,
} from "./adult-pilot-stage1-invite-ledger-proposal.mjs";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const sha256Pattern = /^[a-f0-9]{64}$/;

const canonicalBytes = (value) =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

const derivedPaths = (proposalPath, ledgerPath) => ({
  backupPath: `${proposalPath}.ledger-before-apply.json`,
  intentPath: `${proposalPath}.apply-intent.json`,
  appliedReceiptPath: `${proposalPath}.applied.json`,
  temporaryLedgerPrefix: `${ledgerPath}.status-apply-`,
});

const transitionedEntry = (entry, proposal) => {
  const updated = { ...entry, status: proposal.targetStatus };
  if (proposal.targetStatus === "ACTIVE")
    updated.consentedAt = proposal.occurredAt;
  if (proposal.targetStatus === "STOPPED")
    updated.stoppedAt = proposal.occurredAt;
  return updated;
};

const validateExpectedProposal = (
  proposal,
  ledger,
  ledgerBytes,
  ledgerPath,
) => {
  if (proposal.sourceLedgerBinding !== sourceBinding(ledgerBytes, ledgerPath))
    throw new Error("状態遷移proposalが現在の招待台帳と一致しません。");
  const index = ledger.entries.findIndex(
    (entry) => entry.monitorId === proposal.monitorId,
  );
  if (index < 0 || ledger.entries[index].status !== proposal.sourceStatus)
    throw new Error("状態遷移proposalの対象または遷移前状態が一致しません。");
  const sourceEntry = ledger.entries[index];
  const occurredAt = Date.parse(proposal.occurredAt);
  if (
    occurredAt < Date.parse(sourceEntry.distributedAt) ||
    (sourceEntry.status === "ACTIVE" &&
      occurredAt < Date.parse(sourceEntry.consentedAt))
  )
    throw new Error("状態遷移proposalの時系列が招待台帳と一致しません。");
  const expectedLedger = {
    ...ledger,
    entries: ledger.entries.map((entry, entryIndex) =>
      entryIndex === index ? transitionedEntry(entry, proposal) : entry,
    ),
  };
  if (
    !canonicalBytes(proposal.updatedLedger).equals(
      canonicalBytes(expectedLedger),
    )
  )
    throw new Error("状態遷移proposalが対象entry以外を変更しています。");
  return canonicalBytes(expectedLedger);
};

const validateIntent = (intent, snapshot) => {
  exactKeys(
    intent,
    [
      "format",
      "version",
      "preparedAt",
      "sourceLedgerSha256",
      "proposalSha256",
      "targetLedgerSha256",
      "sourceStatus",
      "targetStatus",
      "statusLedgerApplyAuthorized",
    ],
    "状態遷移適用intent",
  );
  if (
    intent.format !== "mangai.desktop-adult-pilot-ledger-status-apply-intent" ||
    intent.version !== 1 ||
    !isTimestamp(intent.preparedAt) ||
    !sha256Pattern.test(intent.sourceLedgerSha256 ?? "") ||
    intent.sourceLedgerSha256 !== snapshot.sourceLedgerSha256 ||
    intent.proposalSha256 !== snapshot.proposalSha256 ||
    intent.targetLedgerSha256 !== snapshot.targetLedgerSha256 ||
    intent.sourceStatus !== snapshot.proposal.sourceStatus ||
    intent.targetStatus !== snapshot.proposal.targetStatus ||
    intent.statusLedgerApplyAuthorized !== true ||
    Date.parse(intent.preparedAt) < Date.parse(snapshot.proposal.createdAt) ||
    Date.parse(intent.preparedAt) > snapshot.applyAt
  )
    throw new Error("状態遷移適用intentがproposalと一致しません。");
  return intent;
};

const readSnapshot = (options, sourceLedgerBytes) => {
  const proposalBytes = readFile(options.proposalPath, "状態遷移proposal");
  const ledger = validateLedger(readJson(sourceLedgerBytes, "適用前招待台帳"));
  const proposal = validateStatusProposal(
    readJson(proposalBytes, "状態遷移proposal"),
  );
  const targetLedgerBytes = validateExpectedProposal(
    proposal,
    ledger,
    sourceLedgerBytes,
    options.ledgerPath,
  );
  if (options.now.getTime() < Date.parse(proposal.createdAt))
    throw new Error("状態遷移proposal作成前には適用できません。");
  return {
    proposal,
    proposalBytes,
    sourceLedgerBytes,
    targetLedgerBytes,
    sourceLedgerSha256: digest(sourceLedgerBytes),
    proposalSha256: digest(proposalBytes),
    targetLedgerSha256: digest(targetLedgerBytes),
    applyAt: options.now.getTime(),
  };
};

const writeExclusive = (target, bytes) => {
  const handle = fs.openSync(target, "wx", 0o600);
  try {
    fs.writeFileSync(handle, bytes);
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
};

const rereadSources = (options, snapshot, sourcePath) => {
  for (const [target, label, original] of [
    [sourcePath, "適用前招待台帳", snapshot.sourceLedgerBytes],
    [options.proposalPath, "状態遷移proposal", snapshot.proposalBytes],
  ])
    if (!readFile(target, label).equals(original))
      throw new Error(`${label}が適用中に変更されました。`);
};

const createOrReadIntent = (options, paths, snapshot) => {
  if (fs.existsSync(paths.intentPath))
    return validateIntent(
      readJson(
        readFile(paths.intentPath, "状態遷移適用intent"),
        "状態遷移適用intent",
      ),
      snapshot,
    );
  const intent = {
    format: "mangai.desktop-adult-pilot-ledger-status-apply-intent",
    version: 1,
    preparedAt: options.now.toISOString(),
    sourceLedgerSha256: snapshot.sourceLedgerSha256,
    proposalSha256: snapshot.proposalSha256,
    targetLedgerSha256: snapshot.targetLedgerSha256,
    sourceStatus: snapshot.proposal.sourceStatus,
    targetStatus: snapshot.proposal.targetStatus,
    statusLedgerApplyAuthorized: true,
  };
  writeExclusive(paths.intentPath, canonicalBytes(intent));
  return intent;
};

const writeAppliedReceipt = (options, paths, snapshot, recovered) => {
  const receipt = {
    format: "mangai.desktop-adult-pilot-ledger-status-applied-receipt",
    version: 1,
    appliedAt: options.now.toISOString(),
    sourceLedgerSha256: snapshot.sourceLedgerSha256,
    proposalSha256: snapshot.proposalSha256,
    appliedLedgerSha256: snapshot.targetLedgerSha256,
    sourceStatus: snapshot.proposal.sourceStatus,
    targetStatus: snapshot.proposal.targetStatus,
    recoveredAfterCommitInterruption: recovered,
    result: "APPLIED",
  };
  const temporary = `${paths.appliedReceiptPath}.${crypto.randomUUID()}.tmp`;
  writeExclusive(temporary, canonicalBytes(receipt));
  try {
    fs.renameSync(temporary, paths.appliedReceiptPath);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {}
    throw error;
  }
  return receipt;
};

const assertPaths = (options) => {
  for (const [target, label] of [
    [options.ledgerPath, "招待台帳"],
    [options.proposalPath, "状態遷移proposal"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  const paths = derivedPaths(options.proposalPath, options.ledgerPath);
  for (const [target, label] of [
    [paths.backupPath, "招待台帳backup"],
    [paths.intentPath, "状態遷移適用intent"],
    [paths.appliedReceiptPath, "状態遷移適用receipt"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  return paths;
};

export const applyInviteLedgerStatusProposal = (rawOptions) => {
  const options = {
    ...rawOptions,
    repositoryRoot: rawOptions.repositoryRoot ?? defaultRepositoryRoot,
    now: rawOptions.now ?? new Date(),
  };
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("状態遷移適用日時が不正です。");
  if (
    options.confirmProposalReviewed !== true ||
    options.confirmRecoveryBackup !== true ||
    options.confirmLedgerApply !== true
  )
    throw new Error("状態遷移適用に必要な明示確認が完了していません。");
  const paths = assertPaths(options);
  if (fs.existsSync(paths.appliedReceiptPath))
    throw new Error("この状態遷移proposalは適用済みです。");

  const currentLedgerBytes = readFile(options.ledgerPath, "招待台帳");
  const rawProposal = validateStatusProposal(
    readJson(
      readFile(options.proposalPath, "状態遷移proposal"),
      "状態遷移proposal",
    ),
  );
  const targetBytes = canonicalBytes(rawProposal.updatedLedger);
  if (currentLedgerBytes.equals(targetBytes)) {
    const backupBytes = readFile(paths.backupPath, "招待台帳backup");
    const snapshot = readSnapshot(options, backupBytes);
    validateIntent(
      readJson(
        readFile(paths.intentPath, "状態遷移適用intent"),
        "状態遷移適用intent",
      ),
      snapshot,
    );
    rereadSources(options, snapshot, paths.backupPath);
    if (
      !readFile(options.ledgerPath, "適用済み招待台帳").equals(
        snapshot.targetLedgerBytes,
      )
    )
      throw new Error("適用済み招待台帳が回復確認中に変更されました。");
    return {
      appliedReceipt: writeAppliedReceipt(options, paths, snapshot, true),
      recovered: true,
      backupPath: paths.backupPath,
    };
  }

  const snapshot = readSnapshot(options, currentLedgerBytes);
  if (fs.existsSync(paths.backupPath)) {
    if (
      !readFile(paths.backupPath, "招待台帳backup").equals(currentLedgerBytes)
    )
      throw new Error("既存backupが適用前の招待台帳と一致しません。");
  } else writeExclusive(paths.backupPath, currentLedgerBytes);
  validateIntent(createOrReadIntent(options, paths, snapshot), snapshot);

  const temporary = `${paths.temporaryLedgerPrefix}${crypto.randomUUID()}.tmp`;
  writeExclusive(temporary, snapshot.targetLedgerBytes);
  try {
    if (typeof options.beforeCommit === "function") options.beforeCommit();
    rereadSources(options, snapshot, options.ledgerPath);
    if (
      !readFile(temporary, "招待台帳一時file").equals(
        snapshot.targetLedgerBytes,
      )
    )
      throw new Error("招待台帳一時fileが変更されました。");
    fs.renameSync(temporary, options.ledgerPath);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {}
    throw error;
  }
  if (typeof options.afterLedgerCommit === "function")
    options.afterLedgerCommit();
  if (
    !readFile(options.ledgerPath, "適用済み招待台帳").equals(
      snapshot.targetLedgerBytes,
    )
  )
    throw new Error("状態遷移の適用結果を確認できませんでした。");
  return {
    appliedReceipt: writeAppliedReceipt(options, paths, snapshot, false),
    recovered: false,
    backupPath: paths.backupPath,
  };
};

const valueFlags = new Set(["--ledger", "--proposal"]);
const booleanFlags = new Set([
  "--confirm-proposal-reviewed",
  "--confirm-recovery-backup",
  "--confirm-ledger-apply",
]);
const parseArgs = (args) => {
  const parsed = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!valueFlags.has(argument) && !booleanFlags.has(argument))
      throw new Error("未対応の引数があります。");
    if (parsed.has(argument))
      throw new Error("同じ引数を複数回指定できません。");
    if (booleanFlags.has(argument)) {
      parsed.set(argument, true);
      continue;
    }
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
        throw new Error("状態遷移適用の引数が不足しています。");
    const result = applyInviteLedgerStatusProposal({
      ledgerPath: args.get("--ledger"),
      proposalPath: args.get("--proposal"),
      confirmProposalReviewed: args.has("--confirm-proposal-reviewed"),
      confirmRecoveryBackup: args.has("--confirm-recovery-backup"),
      confirmLedgerApply: args.has("--confirm-ledger-apply"),
    });
    console.log("MANGAI Desktop Adult pilot ledger status apply");
    console.log(`  Recovery finalized: ${result.recovered ? "yes" : "no"}`);
    console.log("  Monitor ID and paths: hidden");
    console.log("  Distribution, Runtime, generation, or credit action: no");
    console.log("  Result: STATUS_LEDGER_APPLIED");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "状態遷移適用のfile操作に失敗しました。"
        : error.message;
    console.error(`Adult pilot ledger status apply failed: ${message}`);
    process.exit(1);
  }
}
