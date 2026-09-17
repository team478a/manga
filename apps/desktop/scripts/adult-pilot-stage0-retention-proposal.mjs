import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { auditAdultPilotStage0Lifecycle } from "./adult-pilot-stage0-lifecycle-audit.mjs";
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
const evidenceRoleOrder = [
  "candidate_assessment",
  "stage0_plan",
  "signed_artifact_evidence",
  "fixed_bundle_evidence",
  "operation_package",
  "start_authorization",
  "start_consumed_receipt",
  "hardware_evidence",
  "completion_evidence",
];

export const canonicalRetentionBytes = (value) =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

const pathKey = (target) => {
  const resolved = path.resolve(target);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

export const stage0RetentionTargets = (options) => [
  {
    role: "candidate_assessment",
    target: options.assessmentPath,
    required: true,
  },
  { role: "stage0_plan", target: options.planPath, required: true },
  {
    role: "signed_artifact_evidence",
    target: options.artifactEvidencePath,
    required: true,
  },
  {
    role: "fixed_bundle_evidence",
    target: options.bundleEvidencePath,
    required: true,
  },
  {
    role: "operation_package",
    target: options.packagePath,
    required: true,
  },
  ...(options.authorizationPath
    ? [
        {
          role: "start_authorization",
          target: options.authorizationPath,
          required: true,
        },
      ]
    : []),
  {
    role: "start_consumed_receipt",
    target: `${options.packagePath}.stage0-start-consumed.json`,
    required: false,
  },
  ...(options.hardwareEvidencePath
    ? [
        {
          role: "hardware_evidence",
          target: options.hardwareEvidencePath,
          required: true,
        },
      ]
    : []),
  {
    role: "completion_evidence",
    target: `${options.packagePath}.stage0-completion.json`,
    required: false,
  },
];

const evidenceSnapshot = (targets) =>
  new Map(
    targets.map(({ target }) => {
      const resolved = path.resolve(target);
      return [
        resolved,
        fs.existsSync(resolved)
          ? digest(readFile(resolved, "Stage 0証跡"))
          : null,
      ];
    }),
  );

export const assertRetentionSnapshotUnchanged = (snapshot) => {
  for (const [target, expected] of snapshot) {
    const exists = fs.existsSync(target);
    if (
      (expected === null && exists) ||
      (expected !== null &&
        (!exists || digest(readFile(target, "Stage 0証跡")) !== expected))
    )
      throw new Error("Stage 0証跡が保持期限proposal処理中に変更されました。");
  }
};

const assertDistinctTargets = (targets, proposalPath) => {
  const keys = new Set();
  for (const target of [...targets.map((item) => item.target), proposalPath]) {
    const key = pathKey(target);
    if (keys.has(key))
      throw new Error("保持期限proposalの対象pathが重複しています。");
    keys.add(key);
  }
};

export const buildStage0RetentionEvidence = (targets) =>
  targets.flatMap(({ role, target, required }) => {
    if (!fs.existsSync(target)) {
      if (required) readFile(target, "Stage 0証跡");
      return [];
    }
    const bytes = readFile(target, "Stage 0証跡");
    return [
      {
        role,
        contentSha256: digest(bytes),
        locationSha256: locationDigest(target),
      },
    ];
  });

const retentionScope = (proposal) => ({
  deleteBy: proposal.deleteBy,
  lifecyclePhase: proposal.lifecyclePhase,
  acceptancePassed: proposal.acceptancePassed,
  evidence: proposal.evidence,
});

export const retentionScopeSha256 = (value) =>
  digest(canonicalRetentionBytes(value));

export const validateStage0RetentionProposal = (proposal) => {
  scanPrivateData(proposal, "Stage 0保持期限proposal");
  exactKeys(
    proposal,
    [
      "format",
      "version",
      "createdAt",
      "deleteBy",
      "proposalLocationSha256",
      "lifecyclePhase",
      "lifecycleState",
      "acceptancePassed",
      "evidence",
      "retentionScopeSha256",
      "retentionChecks",
      "action",
      "deletionAuthorized",
    ],
    "Stage 0保持期限proposal",
  );
  if (
    proposal.format !== "mangai.desktop-adult-stage0-retention-proposal" ||
    proposal.version !== 1 ||
    !isTimestamp(proposal.createdAt) ||
    !isTimestamp(proposal.deleteBy) ||
    Date.parse(proposal.createdAt) < Date.parse(proposal.deleteBy) ||
    !sha256Pattern.test(proposal.proposalLocationSha256 ?? "") ||
    ![
      "OPERATION_PACKAGE",
      "START_AUTHORIZATION",
      "ACCEPTANCE",
      "COMPLETION",
    ].includes(proposal.lifecyclePhase) ||
    proposal.lifecycleState !== "EXPIRED" ||
    typeof proposal.acceptancePassed !== "boolean" ||
    !Array.isArray(proposal.evidence) ||
    proposal.evidence.length < 5 ||
    proposal.evidence.length > evidenceRoleOrder.length ||
    !sha256Pattern.test(proposal.retentionScopeSha256 ?? "") ||
    proposal.action !== "SEPARATE_APPROVAL_AND_APPLY_REQUIRED" ||
    proposal.deletionAuthorized !== false
  )
    throw new Error("Stage 0保持期限proposalの契約が不正です。");

  exactKeys(
    proposal.retentionChecks,
    [
      "scopeReviewed",
      "noRetentionHold",
      "userContentExcluded",
      "separateApplyRequired",
    ],
    "Stage 0保持期限proposal.retentionChecks",
  );
  if (Object.values(proposal.retentionChecks).some((value) => value !== true))
    throw new Error("Stage 0保持期限proposalの確認記録が不正です。");

  let previousRoleIndex = -1;
  for (const evidence of proposal.evidence) {
    exactKeys(
      evidence,
      ["role", "contentSha256", "locationSha256"],
      "Stage 0保持期限proposal.evidence",
    );
    const roleIndex = evidenceRoleOrder.indexOf(evidence.role);
    if (
      roleIndex <= previousRoleIndex ||
      !sha256Pattern.test(evidence.contentSha256 ?? "") ||
      !sha256Pattern.test(evidence.locationSha256 ?? "")
    )
      throw new Error("Stage 0保持期限proposalの証跡scopeが不正です。");
    previousRoleIndex = roleIndex;
  }
  const roles = new Set(proposal.evidence.map((evidence) => evidence.role));
  const has = (role) => roles.has(role);
  if (
    evidenceRoleOrder.slice(0, 5).some((role) => !has(role)) ||
    (has("start_consumed_receipt") && !has("start_authorization")) ||
    (has("hardware_evidence") && !has("start_consumed_receipt")) ||
    (has("completion_evidence") && !has("hardware_evidence")) ||
    (proposal.lifecyclePhase === "OPERATION_PACKAGE" && roles.size !== 5) ||
    (proposal.lifecyclePhase === "START_AUTHORIZATION" &&
      (!has("start_authorization") ||
        has("start_consumed_receipt") ||
        has("hardware_evidence") ||
        has("completion_evidence"))) ||
    (proposal.lifecyclePhase === "ACCEPTANCE" &&
      (!has("start_authorization") ||
        !has("start_consumed_receipt") ||
        has("completion_evidence"))) ||
    (proposal.lifecyclePhase === "COMPLETION" &&
      (!has("start_authorization") ||
        !has("start_consumed_receipt") ||
        !has("hardware_evidence") ||
        !has("completion_evidence"))) ||
    proposal.acceptancePassed !== (proposal.lifecyclePhase === "COMPLETION")
  )
    throw new Error("Stage 0保持期限proposalのphaseと証跡scopeが不正です。");
  if (
    proposal.retentionScopeSha256 !==
    retentionScopeSha256(retentionScope(proposal))
  )
    throw new Error("Stage 0保持期限proposalのscope digestが不正です。");
  return proposal;
};

export const normalizedRetentionOptions = (rawOptions) => ({
  ...rawOptions,
  repositoryRoot: rawOptions.repositoryRoot ?? defaultRepositoryRoot,
  lifecycleAuditor:
    rawOptions.lifecycleAuditor ?? auditAdultPilotStage0Lifecycle,
  now: rawOptions.now ?? new Date(),
});

export const assertRetentionPaths = (options, proposalPath) => {
  const targets = stage0RetentionTargets(options);
  for (const { target, role } of targets)
    assertPrivatePath(options.repositoryRoot, target, `Stage 0証跡(${role})`);
  assertPrivatePath(
    options.repositoryRoot,
    proposalPath,
    "Stage 0保持期限proposal",
  );
  assertDistinctTargets(targets, proposalPath);
  return targets;
};

export const readDeleteBy = (packagePath) => {
  const operationPackage = readJson(
    readFile(packagePath, "operation package"),
    "operation package",
  );
  if (!isTimestamp(operationPackage.deleteBy))
    throw new Error("operation packageの削除期限が不正です。");
  return operationPackage.deleteBy;
};

export const runRetentionLifecycleAudit = (options) =>
  options.lifecycleAuditor({
    repositoryRoot: options.repositoryRoot,
    assessmentPath: options.assessmentPath,
    planPath: options.planPath,
    artifactEvidencePath: options.artifactEvidencePath,
    bundleEvidencePath: options.bundleEvidencePath,
    packagePath: options.packagePath,
    authorizationPath: options.authorizationPath,
    hardwareEvidencePath: options.hardwareEvidencePath,
    operationPackageVerifier: options.operationPackageVerifier,
    now: options.now,
  });

export const createStage0RetentionProposal = (rawOptions) => {
  const options = normalizedRetentionOptions(rawOptions);
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("保持期限proposal作成日時が不正です。");
  if (
    options.confirmRetentionScopeReviewed !== true ||
    options.confirmNoRetentionHold !== true ||
    options.confirmUserContentExcluded !== true ||
    options.confirmSeparateApplyRequired !== true
  )
    throw new Error("保持期限proposalに必要な明示確認が完了していません。");

  const targets = assertRetentionPaths(options, options.outputPath);
  const snapshot = evidenceSnapshot(targets);
  const lifecycle = runRetentionLifecycleAudit(options);
  if (
    lifecycle.state !== "EXPIRED" ||
    lifecycle.retentionActionRequired !== true
  )
    throw new Error("削除期限へ到達したStage 0証跡だけを対象にできます。");
  const deleteBy = readDeleteBy(options.packagePath);
  if (options.now.getTime() < Date.parse(deleteBy))
    throw new Error("Stage 0証跡の削除期限へ到達していません。");
  const evidence = buildStage0RetentionEvidence(targets);
  const scope = {
    deleteBy,
    lifecyclePhase: lifecycle.phase,
    acceptancePassed: lifecycle.acceptancePassed,
    evidence,
  };
  const proposal = validateStage0RetentionProposal({
    format: "mangai.desktop-adult-stage0-retention-proposal",
    version: 1,
    createdAt: options.now.toISOString(),
    ...scope,
    proposalLocationSha256: locationDigest(options.outputPath),
    lifecycleState: "EXPIRED",
    retentionScopeSha256: retentionScopeSha256(scope),
    retentionChecks: {
      scopeReviewed: true,
      noRetentionHold: true,
      userContentExcluded: true,
      separateApplyRequired: true,
    },
    action: "SEPARATE_APPROVAL_AND_APPLY_REQUIRED",
    deletionAuthorized: false,
  });

  if (typeof options.beforeWrite === "function") options.beforeWrite();
  assertRetentionSnapshotUnchanged(snapshot);
  fs.writeFileSync(options.outputPath, canonicalRetentionBytes(proposal), {
    flag: "wx",
    mode: 0o600,
  });
  return { proposal, outputPath: options.outputPath };
};

export const retentionValueFlags = new Set([
  "--assessment",
  "--plan",
  "--artifact-evidence",
  "--bundle-evidence",
  "--package",
  "--authorization",
  "--hardware-evidence",
  "--out",
]);
export const retentionBooleanFlags = new Set([
  "--confirm-retention-scope-reviewed",
  "--confirm-no-retention-hold",
  "--confirm-user-content-excluded",
  "--confirm-separate-apply-required",
]);

export const parseRetentionArgs = (args, valueFlags, booleanFlags) => {
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
    const args = parseRetentionArgs(
      process.argv.slice(2),
      retentionValueFlags,
      retentionBooleanFlags,
    );
    for (const flag of [
      "--assessment",
      "--plan",
      "--artifact-evidence",
      "--bundle-evidence",
      "--package",
      "--out",
    ])
      if (!args.has(flag))
        throw new Error("保持期限proposalの引数が不足しています。");
    const result = createStage0RetentionProposal({
      assessmentPath: args.get("--assessment"),
      planPath: args.get("--plan"),
      artifactEvidencePath: args.get("--artifact-evidence"),
      bundleEvidencePath: args.get("--bundle-evidence"),
      packagePath: args.get("--package"),
      authorizationPath: args.get("--authorization"),
      hardwareEvidencePath: args.get("--hardware-evidence"),
      outputPath: args.get("--out"),
      confirmRetentionScopeReviewed: args.has(
        "--confirm-retention-scope-reviewed",
      ),
      confirmNoRetentionHold: args.has("--confirm-no-retention-hold"),
      confirmUserContentExcluded: args.has("--confirm-user-content-excluded"),
      confirmSeparateApplyRequired: args.has(
        "--confirm-separate-apply-required",
      ),
    });
    console.log("MANGAI Desktop Adult Stage 0 retention proposal");
    console.log(`  Evidence files: ${result.proposal.evidence.length}`);
    console.log("  Lifecycle state: EXPIRED");
    console.log("  Deletion authorized: no");
    console.log("  Candidate identity, content, and paths: hidden");
    console.log("  Evidence files changed: no");
    console.log("  External action: no");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "保持期限proposalのfile操作に失敗しました。"
        : error.message;
    console.error(`Adult Stage 0 retention proposal failed: ${message}`);
    process.exit(1);
  }
}
