import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertPrivatePath,
  assertTimeBoundary,
  digest,
  exactKeys,
  isTimestamp,
  readFile,
  readJson,
  sourceBinding,
  validateAssessment,
  validateAuthorization,
  validateLedger,
  validateReceipt,
} from "./adult-pilot-stage1-invite-ledger-proposal.mjs";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const sha256Pattern = /^[a-f0-9]{64}$/;

const canonicalBytes = (value) =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

const derivedPaths = (authorizationPath, ledgerPath) => ({
  consumedReceiptPath: `${authorizationPath}.consumed.json`,
  proposalPath: `${authorizationPath}.ledger-proposal.json`,
  backupPath: `${authorizationPath}.ledger-before-apply.json`,
  intentPath: `${authorizationPath}.ledger-apply-intent.json`,
  appliedReceiptPath: `${authorizationPath}.ledger-applied.json`,
  temporaryLedgerPrefix: `${ledgerPath}.stage1-apply-`,
});

const validateIntent = (intent, snapshot) => {
  exactKeys(
    intent,
    [
      "format",
      "version",
      "preparedAt",
      "authorizationSha256",
      "sourceLedgerSha256",
      "proposalSha256",
      "stage",
      "stage1LedgerApplyAuthorized",
    ],
    "招待台帳適用intent",
  );
  if (
    intent.format !== "mangai.desktop-adult-stage1-ledger-apply-intent" ||
    intent.version !== 1 ||
    !isTimestamp(intent.preparedAt) ||
    !sha256Pattern.test(intent.authorizationSha256 ?? "") ||
    intent.authorizationSha256 !== snapshot.authorizationSha256 ||
    intent.sourceLedgerSha256 !== snapshot.sourceLedgerSha256 ||
    intent.proposalSha256 !== snapshot.proposalSha256 ||
    intent.stage !== 1 ||
    intent.stage1LedgerApplyAuthorized !== true ||
    Date.parse(intent.preparedAt) < Date.parse(snapshot.receipt.consumedAt) ||
    Date.parse(intent.preparedAt) >=
      Date.parse(snapshot.authorization.expiresAt)
  )
    throw new Error("招待台帳適用intentが承認済みproposalと一致しません。");
  return intent;
};

const readSnapshot = (options, sourceLedgerBytes, boundaryNow) => {
  const paths = derivedPaths(options.authorizationPath, options.ledgerPath);
  const authorizationBytes = readFile(
    options.authorizationPath,
    "Stage 1招待承認",
  );
  const consumedReceiptBytes = readFile(
    paths.consumedReceiptPath,
    "Stage 1招待承認receipt",
  );
  const assessmentBytes = readFile(options.assessmentPath, "候補assessment");
  const proposalBytes = readFile(paths.proposalPath, "招待台帳proposal");
  const authorization = validateAuthorization(
    readJson(authorizationBytes, "Stage 1招待承認"),
    options.authorizationPath,
  );
  const receipt = validateReceipt(
    readJson(consumedReceiptBytes, "Stage 1招待承認receipt"),
    authorization,
    authorizationBytes,
  );
  const assessment = validateAssessment(
    readJson(assessmentBytes, "候補assessment"),
  );
  const sourceLedger = validateLedger(
    readJson(sourceLedgerBytes, "適用前招待台帳"),
  );
  const proposal = validateLedger(readJson(proposalBytes, "招待台帳proposal"));
  if (
    assessment.candidateId !== authorization.candidateId ||
    authorization.sources.assessment !==
      sourceBinding(assessmentBytes, options.assessmentPath) ||
    authorization.sources.ledger !==
      sourceBinding(sourceLedgerBytes, options.ledgerPath)
  )
    throw new Error("候補assessmentまたは適用前台帳が承認時点と一致しません。");

  const expectedEntry = {
    monitorId: authorization.monitorId,
    stage: 1,
    status: "INVITED",
    desktopVersion: authorization.pilotVersion,
    environment: {
      windows: "windows_11",
      vramBand: assessment.environment.vramBand,
    },
    distributedAt: proposal.entries.at(-1)?.distributedAt,
    consentedAt: null,
    stoppedAt: null,
  };
  const expectedProposal = {
    format: "mangai.desktop-adult-pilot-invite-ledger",
    version: 1,
    entries: [...sourceLedger.entries, expectedEntry],
  };
  if (
    proposal.entries.length !== sourceLedger.entries.length + 1 ||
    !proposalBytes.equals(canonicalBytes(expectedProposal))
  )
    throw new Error("招待台帳proposalが承認済み内容と完全一致しません。");
  assertTimeBoundary(
    {
      now: boundaryNow,
      distributedAt: expectedEntry.distributedAt,
    },
    authorization,
    receipt,
  );
  return {
    paths,
    authorization,
    receipt,
    proposal,
    authorizationBytes,
    consumedReceiptBytes,
    assessmentBytes,
    sourceLedgerBytes,
    proposalBytes,
    authorizationSha256: digest(authorizationBytes),
    sourceLedgerSha256: digest(sourceLedgerBytes),
    proposalSha256: digest(proposalBytes),
  };
};

const rereadSnapshotSources = (options, snapshot, sourcePath) => {
  for (const [target, label, original] of [
    [options.authorizationPath, "Stage 1招待承認", snapshot.authorizationBytes],
    [
      snapshot.paths.consumedReceiptPath,
      "Stage 1招待承認receipt",
      snapshot.consumedReceiptBytes,
    ],
    [options.assessmentPath, "候補assessment", snapshot.assessmentBytes],
    [sourcePath, "適用前招待台帳", snapshot.sourceLedgerBytes],
    [snapshot.paths.proposalPath, "招待台帳proposal", snapshot.proposalBytes],
  ])
    if (!readFile(target, label).equals(original))
      throw new Error(`${label}が台帳適用中に変更されました。`);
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

const writeAppliedReceipt = (options, snapshot, recovered) => {
  const receipt = {
    format: "mangai.desktop-adult-stage1-ledger-applied-receipt",
    version: 1,
    appliedAt: options.now.toISOString(),
    authorizationSha256: snapshot.authorizationSha256,
    sourceLedgerSha256: snapshot.sourceLedgerSha256,
    proposalSha256: snapshot.proposalSha256,
    appliedLedgerSha256: snapshot.proposalSha256,
    stage: 1,
    recoveredAfterCommitInterruption: recovered,
    result: "APPLIED",
  };
  const temporaryReceiptPath = `${snapshot.paths.appliedReceiptPath}.${crypto.randomUUID()}.tmp`;
  writeExclusive(temporaryReceiptPath, canonicalBytes(receipt));
  try {
    fs.renameSync(temporaryReceiptPath, snapshot.paths.appliedReceiptPath);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryReceiptPath);
    } catch {}
    throw error;
  }
  return receipt;
};

const createOrReadIntent = (options, snapshot) => {
  if (fs.existsSync(snapshot.paths.intentPath))
    return validateIntent(
      readJson(
        readFile(snapshot.paths.intentPath, "招待台帳適用intent"),
        "招待台帳適用intent",
      ),
      snapshot,
    );
  const intent = {
    format: "mangai.desktop-adult-stage1-ledger-apply-intent",
    version: 1,
    preparedAt: options.now.toISOString(),
    authorizationSha256: snapshot.authorizationSha256,
    sourceLedgerSha256: snapshot.sourceLedgerSha256,
    proposalSha256: snapshot.proposalSha256,
    stage: 1,
    stage1LedgerApplyAuthorized: true,
  };
  writeExclusive(snapshot.paths.intentPath, canonicalBytes(intent));
  return intent;
};

const assertPaths = (options) => {
  for (const [target, label] of [
    [options.authorizationPath, "Stage 1招待承認"],
    [options.assessmentPath, "候補assessment"],
    [options.ledgerPath, "招待台帳"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  const paths = derivedPaths(options.authorizationPath, options.ledgerPath);
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

export const applyStage1InviteLedgerProposal = (rawOptions) => {
  const options = {
    ...rawOptions,
    repositoryRoot: rawOptions.repositoryRoot ?? defaultRepositoryRoot,
    now: rawOptions.now ?? new Date(),
  };
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("招待台帳適用日時が不正です。");
  if (
    options.confirmProposalReviewed !== true ||
    options.confirmRecoveryBackup !== true ||
    options.confirmLedgerApply !== true
  )
    throw new Error("招待台帳適用に必要な明示確認が完了していません。");
  const paths = assertPaths(options);
  if (fs.existsSync(paths.appliedReceiptPath))
    throw new Error("このStage 1招待台帳proposalは適用済みです。");

  const currentLedgerBytes = readFile(options.ledgerPath, "招待台帳");
  const proposalBytes = readFile(paths.proposalPath, "招待台帳proposal");
  if (currentLedgerBytes.equals(proposalBytes)) {
    const backupBytes = readFile(paths.backupPath, "招待台帳backup");
    const intentBytes = readFile(paths.intentPath, "招待台帳適用intent");
    const provisionalSnapshot = readSnapshot(
      options,
      backupBytes,
      new Date(readJson(intentBytes, "招待台帳適用intent").preparedAt),
    );
    validateIntent(
      readJson(intentBytes, "招待台帳適用intent"),
      provisionalSnapshot,
    );
    rereadSnapshotSources(options, provisionalSnapshot, paths.backupPath);
    if (!readFile(options.ledgerPath, "招待台帳").equals(proposalBytes))
      throw new Error("適用済み台帳が回復確認中に変更されました。");
    const appliedReceipt = writeAppliedReceipt(
      options,
      provisionalSnapshot,
      true,
    );
    return { appliedReceipt, recovered: true, backupPath: paths.backupPath };
  }

  const snapshot = readSnapshot(options, currentLedgerBytes, options.now);
  if (fs.existsSync(paths.backupPath)) {
    if (
      !readFile(paths.backupPath, "招待台帳backup").equals(currentLedgerBytes)
    )
      throw new Error("既存backupが承認時点の招待台帳と一致しません。");
  } else writeExclusive(paths.backupPath, currentLedgerBytes);
  const intent = createOrReadIntent(options, snapshot);
  validateIntent(intent, snapshot);

  const temporaryLedgerPath = `${paths.temporaryLedgerPrefix}${crypto.randomUUID()}.tmp`;
  writeExclusive(temporaryLedgerPath, snapshot.proposalBytes);
  try {
    if (typeof options.beforeCommit === "function") options.beforeCommit();
    rereadSnapshotSources(options, snapshot, options.ledgerPath);
    if (
      !readFile(temporaryLedgerPath, "招待台帳一時file").equals(
        snapshot.proposalBytes,
      )
    )
      throw new Error("招待台帳一時fileが変更されました。");
    fs.renameSync(temporaryLedgerPath, options.ledgerPath);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryLedgerPath);
    } catch {}
    throw error;
  }
  if (typeof options.afterLedgerCommit === "function")
    options.afterLedgerCommit();
  if (
    !readFile(options.ledgerPath, "適用済み招待台帳").equals(
      snapshot.proposalBytes,
    )
  )
    throw new Error("招待台帳の適用結果を確認できませんでした。");
  const appliedReceipt = writeAppliedReceipt(options, snapshot, false);
  return { appliedReceipt, recovered: false, backupPath: paths.backupPath };
};

const valueFlags = new Set(["--authorization", "--assessment", "--ledger"]);
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
        throw new Error("招待台帳適用の引数が不足しています。");
    const result = applyStage1InviteLedgerProposal({
      authorizationPath: args.get("--authorization"),
      assessmentPath: args.get("--assessment"),
      ledgerPath: args.get("--ledger"),
      confirmProposalReviewed: args.has("--confirm-proposal-reviewed"),
      confirmRecoveryBackup: args.has("--confirm-recovery-backup"),
      confirmLedgerApply: args.has("--confirm-ledger-apply"),
    });
    console.log("MANGAI Desktop Adult Stage 1 invite ledger apply");
    console.log(`  Recovery finalized: ${result.recovered ? "yes" : "no"}`);
    console.log("  Candidate, monitor ID, and paths: hidden");
    console.log("  Distribution, invitation, Runtime, or generation: no");
    console.log("  Result: LEDGER_APPLIED");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "招待台帳適用のfile操作に失敗しました。"
        : error.message;
    console.error(`Stage 1 invite ledger apply failed: ${message}`);
    process.exit(1);
  }
}
