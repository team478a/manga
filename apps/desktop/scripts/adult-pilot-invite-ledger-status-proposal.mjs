import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertPrivatePath,
  exactKeys,
  isTimestamp,
  readFile,
  readJson,
  scanPrivateData,
  sourceBinding,
  validateLedger,
} from "./adult-pilot-stage1-invite-ledger-proposal.mjs";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const monitorIdPattern = /^monitor-[a-f0-9]{12}$/;
const sourceBindingPattern = /^[a-f0-9]{64}:[a-f0-9]{64}$/;
const allowedTransitions = new Map([
  ["INVITED", new Set(["ACTIVE", "WITHDRAWN"])],
  ["ACTIVE", new Set(["STOPPED", "COMPLETED", "WITHDRAWN"])],
]);
const evidenceByTarget = {
  ACTIVE: "CONSENT_CONFIRMED",
  STOPPED: "STOP_ACTION_CONFIRMED",
  COMPLETED: "COMPLETION_CONFIRMED",
  WITHDRAWN: "WITHDRAWAL_CONFIRMED",
};

const canonicalBytes = (value) =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

const requiredEvidenceConfirmed = (options) => {
  if (options.targetStatus === "ACTIVE") return options.confirmConsentRecorded;
  if (options.targetStatus === "STOPPED")
    return options.confirmStopActionRecorded;
  if (options.targetStatus === "COMPLETED")
    return options.confirmCompletionReviewed;
  if (options.targetStatus === "WITHDRAWN")
    return options.confirmWithdrawalRecorded;
  return false;
};

const transitionedEntry = (entry, targetStatus, occurredAt) => {
  const updated = { ...entry, status: targetStatus };
  if (targetStatus === "ACTIVE") updated.consentedAt = occurredAt;
  if (targetStatus === "STOPPED") updated.stoppedAt = occurredAt;
  return updated;
};

const assertTimeBoundary = (entry, targetStatus, occurredAt, now) => {
  if (!isTimestamp(occurredAt)) throw new Error("状態遷移日時が不正です。");
  if (!(now instanceof Date) || Number.isNaN(now.getTime()))
    throw new Error("proposal作成日時が不正です。");
  const eventTime = Date.parse(occurredAt);
  if (eventTime > now.getTime() || eventTime < Date.parse(entry.distributedAt))
    throw new Error("状態遷移日時が台帳の時系列と一致しません。");
  if (
    ["STOPPED", "COMPLETED", "WITHDRAWN"].includes(targetStatus) &&
    entry.status === "ACTIVE" &&
    eventTime < Date.parse(entry.consentedAt)
  )
    throw new Error("状態遷移日時が同意日時より前です。");
};

export const validateStatusProposal = (proposal) => {
  scanPrivateData(proposal, "状態遷移proposal");
  exactKeys(
    proposal,
    [
      "format",
      "version",
      "createdAt",
      "sourceLedgerBinding",
      "monitorId",
      "sourceStatus",
      "targetStatus",
      "occurredAt",
      "evidence",
      "updatedLedger",
    ],
    "状態遷移proposal",
  );
  if (
    proposal.format !==
      "mangai.desktop-adult-pilot-invite-ledger-status-proposal" ||
    proposal.version !== 1 ||
    !isTimestamp(proposal.createdAt) ||
    !sourceBindingPattern.test(proposal.sourceLedgerBinding ?? "") ||
    !monitorIdPattern.test(proposal.monitorId ?? "") ||
    !allowedTransitions
      .get(proposal.sourceStatus)
      ?.has(proposal.targetStatus) ||
    !isTimestamp(proposal.occurredAt) ||
    Date.parse(proposal.occurredAt) > Date.parse(proposal.createdAt) ||
    proposal.evidence !== evidenceByTarget[proposal.targetStatus]
  )
    throw new Error("状態遷移proposalの契約が不正です。");
  validateLedger(proposal.updatedLedger);
  const matches = proposal.updatedLedger.entries.filter(
    (entry) => entry.monitorId === proposal.monitorId,
  );
  if (matches.length !== 1 || matches[0].status !== proposal.targetStatus)
    throw new Error("状態遷移proposalの対象entryが不正です。");
  return proposal;
};

export const createInviteLedgerStatusProposal = (rawOptions) => {
  const options = {
    ...rawOptions,
    repositoryRoot: rawOptions.repositoryRoot ?? defaultRepositoryRoot,
    now: rawOptions.now ?? new Date(),
  };
  for (const [target, label] of [
    [options.ledgerPath, "招待台帳"],
    [options.outputPath, "状態遷移proposal"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  if (
    options.confirmStatusEvidenceReviewed !== true ||
    options.confirmContentRemainedLocal !== true ||
    requiredEvidenceConfirmed(options) !== true
  )
    throw new Error("状態遷移proposalに必要な明示確認が完了していません。");

  const ledgerBytes = readFile(options.ledgerPath, "招待台帳");
  const ledger = validateLedger(readJson(ledgerBytes, "招待台帳"));
  if (!monitorIdPattern.test(options.monitorId ?? ""))
    throw new Error("monitor IDが不正です。");
  const index = ledger.entries.findIndex(
    (entry) => entry.monitorId === options.monitorId,
  );
  if (index < 0) throw new Error("対象monitorが招待台帳に存在しません。");
  const sourceEntry = ledger.entries[index];
  if (!allowedTransitions.get(sourceEntry.status)?.has(options.targetStatus))
    throw new Error("許可されていない状態遷移です。");
  assertTimeBoundary(
    sourceEntry,
    options.targetStatus,
    options.occurredAt,
    options.now,
  );

  const entries = ledger.entries.map((entry, entryIndex) =>
    entryIndex === index
      ? transitionedEntry(entry, options.targetStatus, options.occurredAt)
      : entry,
  );
  const proposal = validateStatusProposal({
    format: "mangai.desktop-adult-pilot-invite-ledger-status-proposal",
    version: 1,
    createdAt: options.now.toISOString(),
    sourceLedgerBinding: sourceBinding(ledgerBytes, options.ledgerPath),
    monitorId: options.monitorId,
    sourceStatus: sourceEntry.status,
    targetStatus: options.targetStatus,
    occurredAt: options.occurredAt,
    evidence: evidenceByTarget[options.targetStatus],
    updatedLedger: { ...ledger, entries },
  });
  if (typeof options.beforeWrite === "function") options.beforeWrite();
  if (!readFile(options.ledgerPath, "招待台帳").equals(ledgerBytes))
    throw new Error("招待台帳がproposal作成中に変更されました。");
  fs.writeFileSync(options.outputPath, canonicalBytes(proposal), {
    flag: "wx",
    mode: 0o600,
  });
  return { proposal, outputPath: options.outputPath };
};

const valueFlags = new Set([
  "--ledger",
  "--out",
  "--monitor-id",
  "--target-status",
  "--occurred-at",
]);
const booleanFlags = new Set([
  "--confirm-status-evidence-reviewed",
  "--confirm-content-remained-local",
  "--confirm-consent-recorded",
  "--confirm-stop-action-recorded",
  "--confirm-completion-reviewed",
  "--confirm-withdrawal-recorded",
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
        throw new Error("状態遷移proposalの引数が不足しています。");
    const result = createInviteLedgerStatusProposal({
      ledgerPath: args.get("--ledger"),
      outputPath: args.get("--out"),
      monitorId: args.get("--monitor-id"),
      targetStatus: args.get("--target-status"),
      occurredAt: args.get("--occurred-at"),
      confirmStatusEvidenceReviewed: args.has(
        "--confirm-status-evidence-reviewed",
      ),
      confirmContentRemainedLocal: args.has("--confirm-content-remained-local"),
      confirmConsentRecorded: args.has("--confirm-consent-recorded"),
      confirmStopActionRecorded: args.has("--confirm-stop-action-recorded"),
      confirmCompletionReviewed: args.has("--confirm-completion-reviewed"),
      confirmWithdrawalRecorded: args.has("--confirm-withdrawal-recorded"),
    });
    console.log("MANGAI Desktop Adult pilot ledger status proposal");
    console.log(
      `  Transition: ${result.proposal.sourceStatus} -> ${result.proposal.targetStatus}`,
    );
    console.log("  Monitor ID and paths: hidden");
    console.log("  Existing ledger replaced: no");
    console.log("  Runtime, generation, distribution, or credit action: no");
    console.log("  Result: PROPOSAL_CREATED");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "状態遷移proposalのfile操作に失敗しました。"
        : error.message;
    console.error(`Adult pilot ledger status proposal failed: ${message}`);
    process.exit(1);
  }
}
