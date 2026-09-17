import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { auditStage0RetentionProposal } from "./adult-pilot-stage0-retention-audit.mjs";
import {
  assertRetentionPaths,
  normalizedRetentionOptions,
  parseRetentionArgs,
  stage0RetentionTargets,
  validateStage0RetentionProposal,
} from "./adult-pilot-stage0-retention-proposal.mjs";
import {
  assertPrivatePath,
  digest,
  exactKeys,
  isTimestamp,
  locationDigest,
  readFile,
  readJson,
  scanPrivateData,
} from "./adult-pilot-stage1-invite-ledger-proposal.mjs";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const sha256Pattern = /^[a-f0-9]{64}$/;
const maximumAuthorizationLifetimeMs = 24 * 60 * 60 * 1000;

export const canonicalRetentionAuthorizationBytes = (value) =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

const pathKey = (target) => {
  const resolved = path.resolve(target);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

const snapshot = (targets) =>
  new Map(
    targets.map((target) => {
      const resolved = path.resolve(target);
      return [
        resolved,
        fs.existsSync(resolved)
          ? digest(readFile(resolved, "保持期限承認対象"))
          : null,
      ];
    }),
  );

const assertSnapshotUnchanged = (observed) => {
  for (const [target, expected] of observed) {
    const exists = fs.existsSync(target);
    if (
      (expected === null && exists) ||
      (expected !== null &&
        (!exists || digest(readFile(target, "保持期限承認対象")) !== expected))
    )
      throw new Error("保持期限削除承認の対象が処理中に変更されました。");
  }
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

export const validateStage0RetentionAuthorization = (
  authorization,
  {
    proposal,
    proposalBytes,
    proposalPath,
    authorizationPath,
    quarantineDirectory,
    effectiveAt,
  },
) => {
  scanPrivateData(authorization, "Stage 0保持期限削除承認");
  exactKeys(
    authorization,
    [
      "format",
      "version",
      "createdAt",
      "expiresAt",
      "proposalSha256",
      "proposalLocationSha256",
      "authorizationLocationSha256",
      "quarantineLocationSha256",
      "retentionScopeSha256",
      "evidenceCount",
      "authorizationChecks",
      "action",
      "deletionAuthorized",
      "stage1DistributionAuthorized",
    ],
    "Stage 0保持期限削除承認",
  );
  exactKeys(
    authorization.authorizationChecks,
    [
      "proposalReviewed",
      "exactEvidenceScopeApproved",
      "noRetentionHold",
      "userContentExcluded",
      "stagedRecoveryUnderstood",
    ],
    "Stage 0保持期限削除承認.authorizationChecks",
  );
  const createdAt = Date.parse(authorization.createdAt);
  const expiresAt = Date.parse(authorization.expiresAt);
  if (
    authorization.format !==
      "mangai.desktop-adult-stage0-retention-deletion-authorization" ||
    authorization.version !== 1 ||
    !isTimestamp(authorization.createdAt) ||
    !isTimestamp(authorization.expiresAt) ||
    expiresAt <= createdAt ||
    expiresAt - createdAt > maximumAuthorizationLifetimeMs ||
    createdAt < Date.parse(proposal.createdAt) ||
    !Number.isFinite(effectiveAt) ||
    effectiveAt < createdAt ||
    effectiveAt > expiresAt ||
    !sha256Pattern.test(authorization.proposalSha256 ?? "") ||
    authorization.proposalSha256 !== digest(proposalBytes) ||
    authorization.proposalLocationSha256 !== locationDigest(proposalPath) ||
    authorization.authorizationLocationSha256 !==
      locationDigest(authorizationPath) ||
    authorization.quarantineLocationSha256 !==
      locationDigest(quarantineDirectory) ||
    authorization.retentionScopeSha256 !== proposal.retentionScopeSha256 ||
    authorization.evidenceCount !== proposal.evidence.length ||
    Object.values(authorization.authorizationChecks).some(
      (value) => value !== true,
    ) ||
    authorization.action !==
      "DELETE_EXACT_STAGE0_OPERATIONAL_EVIDENCE_WITH_STAGED_RECOVERY" ||
    authorization.deletionAuthorized !== true ||
    authorization.stage1DistributionAuthorized !== false
  )
    throw new Error("Stage 0保持期限削除承認がproposalと一致しません。");
  return authorization;
};

const assertAuthorizationPaths = (options) => {
  const targets = assertRetentionPaths(options, options.proposalPath);
  for (const [target, label] of [
    [options.outputPath, "Stage 0保持期限削除承認"],
    [options.quarantineDirectory, "Stage 0保持期限回復領域"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  const keys = new Set();
  for (const target of [
    ...targets.map((item) => item.target),
    options.proposalPath,
    options.outputPath,
    options.quarantineDirectory,
  ]) {
    const key = pathKey(target);
    if (keys.has(key))
      throw new Error("Stage 0保持期限削除承認のpathが重複しています。");
    keys.add(key);
  }
  if (fs.existsSync(options.quarantineDirectory))
    throw new Error(
      "Stage 0保持期限回復領域は未作成のpathを指定してください。",
    );
  return targets;
};

export const createStage0RetentionAuthorization = (rawOptions) => {
  const options = {
    ...normalizedRetentionOptions(rawOptions),
    repositoryRoot: rawOptions.repositoryRoot ?? defaultRepositoryRoot,
  };
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("Stage 0保持期限削除承認日時が不正です。");
  if (
    options.confirmProposalReviewed !== true ||
    options.confirmExactEvidenceScopeApproved !== true ||
    options.confirmNoRetentionHold !== true ||
    options.confirmUserContentExcluded !== true ||
    options.confirmStagedRecoveryUnderstood !== true
  )
    throw new Error(
      "Stage 0保持期限削除承認に必要な明示確認が不足しています。",
    );
  if (!isTimestamp(options.expiresAt))
    throw new Error("Stage 0保持期限削除承認の有効期限が不正です。");

  assertAuthorizationPaths(options);
  const observed = snapshot([
    ...stage0RetentionTargets(options).map((item) => item.target),
    options.proposalPath,
    options.outputPath,
    options.quarantineDirectory,
  ]);
  auditStage0RetentionProposal({
    ...options,
    proposalPath: options.proposalPath,
  });
  const proposalBytes = readFile(
    options.proposalPath,
    "Stage 0保持期限proposal",
  );
  const proposal = validateStage0RetentionProposal(
    readJson(proposalBytes, "Stage 0保持期限proposal"),
  );
  const authorization = {
    format: "mangai.desktop-adult-stage0-retention-deletion-authorization",
    version: 1,
    createdAt: options.now.toISOString(),
    expiresAt: options.expiresAt,
    proposalSha256: digest(proposalBytes),
    proposalLocationSha256: locationDigest(options.proposalPath),
    authorizationLocationSha256: locationDigest(options.outputPath),
    quarantineLocationSha256: locationDigest(options.quarantineDirectory),
    retentionScopeSha256: proposal.retentionScopeSha256,
    evidenceCount: proposal.evidence.length,
    authorizationChecks: {
      proposalReviewed: true,
      exactEvidenceScopeApproved: true,
      noRetentionHold: true,
      userContentExcluded: true,
      stagedRecoveryUnderstood: true,
    },
    action: "DELETE_EXACT_STAGE0_OPERATIONAL_EVIDENCE_WITH_STAGED_RECOVERY",
    deletionAuthorized: true,
    stage1DistributionAuthorized: false,
  };
  validateStage0RetentionAuthorization(authorization, {
    proposal,
    proposalBytes,
    proposalPath: options.proposalPath,
    authorizationPath: options.outputPath,
    quarantineDirectory: options.quarantineDirectory,
    effectiveAt: options.now.getTime(),
  });
  if (typeof options.beforeWrite === "function") options.beforeWrite();
  assertSnapshotUnchanged(observed);
  writeExclusive(
    options.outputPath,
    canonicalRetentionAuthorizationBytes(authorization),
  );
  return { authorization, outputPath: options.outputPath };
};

const valueFlags = new Set([
  "--assessment",
  "--plan",
  "--artifact-evidence",
  "--bundle-evidence",
  "--package",
  "--start-authorization",
  "--hardware-evidence",
  "--proposal",
  "--quarantine-dir",
  "--expires-at",
  "--out",
]);
const booleanFlags = new Set([
  "--confirm-proposal-reviewed",
  "--confirm-exact-evidence-scope-approved",
  "--confirm-no-retention-hold",
  "--confirm-user-content-excluded",
  "--confirm-staged-recovery-understood",
]);

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const args = parseRetentionArgs(
      process.argv.slice(2),
      valueFlags,
      booleanFlags,
    );
    for (const flag of [
      "--assessment",
      "--plan",
      "--artifact-evidence",
      "--bundle-evidence",
      "--package",
      "--proposal",
      "--quarantine-dir",
      "--expires-at",
      "--out",
    ])
      if (!args.has(flag))
        throw new Error("Stage 0保持期限削除承認の引数が不足しています。");
    const result = createStage0RetentionAuthorization({
      assessmentPath: args.get("--assessment"),
      planPath: args.get("--plan"),
      artifactEvidencePath: args.get("--artifact-evidence"),
      bundleEvidencePath: args.get("--bundle-evidence"),
      packagePath: args.get("--package"),
      authorizationPath: args.get("--start-authorization"),
      hardwareEvidencePath: args.get("--hardware-evidence"),
      proposalPath: args.get("--proposal"),
      quarantineDirectory: args.get("--quarantine-dir"),
      expiresAt: args.get("--expires-at"),
      outputPath: args.get("--out"),
      confirmProposalReviewed: args.has("--confirm-proposal-reviewed"),
      confirmExactEvidenceScopeApproved: args.has(
        "--confirm-exact-evidence-scope-approved",
      ),
      confirmNoRetentionHold: args.has("--confirm-no-retention-hold"),
      confirmUserContentExcluded: args.has("--confirm-user-content-excluded"),
      confirmStagedRecoveryUnderstood: args.has(
        "--confirm-staged-recovery-understood",
      ),
    });
    console.log("MANGAI Desktop Adult Stage 0 retention authorization");
    console.log(`  Evidence files: ${result.authorization.evidenceCount}`);
    console.log("  Exact expired scope authorized: yes");
    console.log("  Staged recovery and final purge required: yes");
    console.log("  Candidate identity, content, and paths: hidden");
    console.log("  Evidence files changed: no");
    console.log("  External action: no");
    console.log("  Result: AUTHORIZATION_CREATED");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "Stage 0保持期限削除承認のfile操作に失敗しました。"
        : error.message;
    console.error(`Stage 0 retention authorization failed: ${message}`);
    process.exit(1);
  }
}
