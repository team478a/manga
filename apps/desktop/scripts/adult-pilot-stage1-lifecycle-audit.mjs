import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { auditInviteLedgerStatusProposal } from "./adult-pilot-invite-ledger-status-audit.mjs";
import { auditStage1InviteLedgerProposal } from "./adult-pilot-stage1-invite-ledger-audit.mjs";
import { readFile } from "./adult-pilot-stage1-invite-ledger-proposal.mjs";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const canonicalPath = (target) => {
  const resolved = path.resolve(target);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

const assertDistinctStatusProposals = (proposalPaths) => {
  const unique = new Set(proposalPaths.map(canonicalPath));
  if (unique.size !== proposalPaths.length)
    throw new Error("同じ状態遷移proposalを複数回指定できません。");
};

const currentStatusFor = (state, sourceStatus, targetStatus) =>
  state === "RECOVERY_REQUIRED" || state === "APPLIED"
    ? targetStatus
    : sourceStatus;

export const auditAdultPilotStage1Lifecycle = (rawOptions) => {
  const options = {
    ...rawOptions,
    repositoryRoot: rawOptions.repositoryRoot ?? defaultRepositoryRoot,
    now: rawOptions.now ?? new Date(),
    statusProposalPaths: rawOptions.statusProposalPaths ?? [],
  };
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("Stage 1ライフサイクル監査日時が不正です。");
  if (!Array.isArray(options.statusProposalPaths))
    throw new Error("状態遷移proposal一覧が不正です。");
  assertDistinctStatusProposals(options.statusProposalPaths);

  const ledgerBytes = readFile(options.ledgerPath, "招待台帳");
  const hasStatusTransitions = options.statusProposalPaths.length > 0;
  const invite = auditStage1InviteLedgerProposal({
    ...options,
    allowHistoricalCurrentLedger: hasStatusTransitions,
    includeLedgerDetails: true,
  });

  if (!hasStatusTransitions) {
    if (typeof options.beforeFinalVerification === "function")
      options.beforeFinalVerification();
    if (!readFile(options.ledgerPath, "招待台帳").equals(ledgerBytes))
      throw new Error("招待台帳がライフサイクル監査中に変更されました。");
    return {
      phase: "INITIAL_INVITATION",
      state: invite.state,
      currentStatus:
        invite.state === "RECOVERY_REQUIRED" || invite.state === "APPLIED"
          ? "INVITED"
          : "NOT_INVITED",
      statusTransitionCount: 0,
    };
  }
  if (invite.state !== "APPLIED")
    throw new Error("状態遷移履歴の前に初回招待台帳の適用完了が必要です。");

  let previousLedgerBytes = invite.targetLedgerBytes;
  let latest;
  for (const [index, proposalPath] of options.statusProposalPaths.entries()) {
    const isLatest = index === options.statusProposalPaths.length - 1;
    const transition = auditInviteLedgerStatusProposal({
      repositoryRoot: options.repositoryRoot,
      ledgerPath: options.ledgerPath,
      proposalPath,
      now: options.now,
      allowHistoricalCurrentLedger: !isLatest,
      includeLedgerDetails: true,
    });
    if (transition.monitorId !== invite.monitorId)
      throw new Error("状態遷移proposalの対象が初回招待と一致しません。");
    if (!transition.sourceLedgerBytes.equals(previousLedgerBytes))
      throw new Error("状態遷移proposal履歴が連続していません。");
    if (!isLatest && transition.state !== "APPLIED")
      throw new Error(
        "途中の状態遷移proposalは適用完了している必要があります。",
      );
    previousLedgerBytes = transition.targetLedgerBytes;
    latest = transition;
  }

  if (typeof options.beforeFinalVerification === "function")
    options.beforeFinalVerification();
  if (!readFile(options.ledgerPath, "招待台帳").equals(ledgerBytes))
    throw new Error("招待台帳がライフサイクル監査中に変更されました。");
  return {
    phase: "STATUS_TRANSITION",
    state: latest.state,
    currentStatus: currentStatusFor(
      latest.state,
      latest.sourceStatus,
      latest.targetStatus,
    ),
    statusTransitionCount: options.statusProposalPaths.length,
  };
};

const valueFlags = new Set([
  "--authorization",
  "--assessment",
  "--ledger",
  "--status-proposal",
]);
const parseArgs = (args) => {
  const parsed = new Map();
  const statusProposalPaths = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!valueFlags.has(argument)) throw new Error("未対応の引数があります。");
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error("値が必要な引数があります。");
    if (argument === "--status-proposal") statusProposalPaths.push(value);
    else {
      if (parsed.has(argument))
        throw new Error("同じ引数を複数回指定できません。");
      parsed.set(argument, value);
    }
    index += 1;
  }
  return { parsed, statusProposalPaths };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const { parsed, statusProposalPaths } = parseArgs(process.argv.slice(2));
    for (const flag of ["--authorization", "--assessment", "--ledger"])
      if (!parsed.has(flag))
        throw new Error("Stage 1ライフサイクル監査の引数が不足しています。");
    const result = auditAdultPilotStage1Lifecycle({
      authorizationPath: parsed.get("--authorization"),
      assessmentPath: parsed.get("--assessment"),
      ledgerPath: parsed.get("--ledger"),
      statusProposalPaths,
    });
    console.log("MANGAI Desktop Adult Stage 1 lifecycle audit");
    console.log(`  Phase: ${result.phase}`);
    console.log(`  State: ${result.state}`);
    console.log(`  Current status: ${result.currentStatus}`);
    console.log(
      `  Status transitions audited: ${result.statusTransitionCount}`,
    );
    console.log("  Candidate, monitor ID, and paths: hidden");
    console.log("  Files changed: no");
    console.log("  External action: no");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "Stage 1ライフサイクル監査のfile操作に失敗しました。"
        : error.message;
    console.error(`Adult Stage 1 lifecycle audit failed: ${message}`);
    process.exit(1);
  }
}
