import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertRetentionPaths,
  assertRetentionSnapshotUnchanged,
  buildStage0RetentionEvidence,
  canonicalRetentionBytes,
  normalizedRetentionOptions,
  parseRetentionArgs,
  readDeleteBy,
  retentionScopeSha256,
  retentionValueFlags,
  runRetentionLifecycleAudit,
  stage0RetentionTargets,
  validateStage0RetentionProposal,
} from "./adult-pilot-stage0-retention-proposal.mjs";
import {
  locationDigest,
  readFile,
  readJson,
} from "./adult-pilot-stage1-invite-ledger-proposal.mjs";

const snapshot = (targets) =>
  new Map(
    targets.map((target) => [
      path.resolve(target),
      fs.existsSync(target)
        ? crypto
            .createHash("sha256")
            .update(readFile(target, "保持期限監査対象"))
            .digest("hex")
        : null,
    ]),
  );

export const auditStage0RetentionProposal = (rawOptions) => {
  const options = normalizedRetentionOptions(rawOptions);
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("保持期限proposal監査日時が不正です。");
  const targets = assertRetentionPaths(options, options.proposalPath);
  const observedTargets = [
    ...stage0RetentionTargets(options).map((item) => item.target),
    options.proposalPath,
  ];
  const before = snapshot(observedTargets);
  const proposalBytes = readFile(
    options.proposalPath,
    "Stage 0保持期限proposal",
  );
  const proposal = validateStage0RetentionProposal(
    readJson(proposalBytes, "Stage 0保持期限proposal"),
  );
  if (proposal.proposalLocationSha256 !== locationDigest(options.proposalPath))
    throw new Error("保持期限proposalの保存場所が作成時と一致しません。");
  if (Date.parse(proposal.createdAt) > options.now.getTime())
    throw new Error("保持期限proposalの作成日時が未来です。");

  const lifecycle = runRetentionLifecycleAudit(options);
  if (
    lifecycle.state !== "EXPIRED" ||
    lifecycle.retentionActionRequired !== true
  )
    throw new Error("保持期限proposalの原本は現在EXPIREDではありません。");
  const deleteBy = readDeleteBy(options.packagePath);
  const evidence = buildStage0RetentionEvidence(targets);
  const scope = {
    deleteBy,
    lifecyclePhase: lifecycle.phase,
    acceptancePassed: lifecycle.acceptancePassed,
    evidence,
  };
  const expected = {
    ...proposal,
    deleteBy,
    proposalLocationSha256: locationDigest(options.proposalPath),
    lifecyclePhase: lifecycle.phase,
    lifecycleState: "EXPIRED",
    acceptancePassed: lifecycle.acceptancePassed,
    evidence,
    retentionScopeSha256: retentionScopeSha256(scope),
    retentionChecks: {
      scopeReviewed: true,
      noRetentionHold: true,
      userContentExcluded: true,
      separateApplyRequired: true,
    },
    action: "SEPARATE_APPROVAL_AND_APPLY_REQUIRED",
    deletionAuthorized: false,
  };
  if (
    !canonicalRetentionBytes(proposal).equals(canonicalRetentionBytes(expected))
  )
    throw new Error("保持期限proposalが現在のStage 0証跡と一致しません。");

  if (typeof options.beforeFinalVerification === "function")
    options.beforeFinalVerification();
  assertRetentionSnapshotUnchanged(before);
  return {
    state: "PROPOSAL_READY",
    lifecyclePhase: lifecycle.phase,
    evidenceCount: proposal.evidence.length,
    deletionAuthorized: false,
  };
};

const auditValueFlags = new Set(
  [...retentionValueFlags].filter((flag) => flag !== "--out"),
);
auditValueFlags.add("--proposal");
const noBooleanFlags = new Set();

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const args = parseRetentionArgs(
      process.argv.slice(2),
      auditValueFlags,
      noBooleanFlags,
    );
    for (const flag of [
      "--assessment",
      "--plan",
      "--artifact-evidence",
      "--bundle-evidence",
      "--package",
      "--proposal",
    ])
      if (!args.has(flag))
        throw new Error("保持期限proposal監査の引数が不足しています。");
    const result = auditStage0RetentionProposal({
      assessmentPath: args.get("--assessment"),
      planPath: args.get("--plan"),
      artifactEvidencePath: args.get("--artifact-evidence"),
      bundleEvidencePath: args.get("--bundle-evidence"),
      packagePath: args.get("--package"),
      authorizationPath: args.get("--authorization"),
      hardwareEvidencePath: args.get("--hardware-evidence"),
      proposalPath: args.get("--proposal"),
    });
    console.log("MANGAI Desktop Adult Stage 0 retention audit");
    console.log(`  State: ${result.state}`);
    console.log(`  Lifecycle phase: ${result.lifecyclePhase}`);
    console.log(`  Evidence files: ${result.evidenceCount}`);
    console.log("  Deletion authorized: no");
    console.log("  Candidate identity, content, and paths: hidden");
    console.log("  Files changed: no");
    console.log("  External action: no");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "保持期限proposal監査のfile操作に失敗しました。"
        : error.message;
    console.error(`Adult Stage 0 retention audit failed: ${message}`);
    process.exit(1);
  }
}
