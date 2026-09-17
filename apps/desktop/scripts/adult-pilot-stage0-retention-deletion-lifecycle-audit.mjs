import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { auditStage0RetentionProposal } from "./adult-pilot-stage0-retention-audit.mjs";
import { validateStage0RetentionAuthorization } from "./adult-pilot-stage0-retention-authorization.mjs";
import {
  readRetentionDeletionContext,
  retentionDeletionDerivedPaths,
  validateRetentionDeleteIntent,
  validateRetentionPurgeIntent,
  validateRetentionQuarantineManifest,
} from "./adult-pilot-stage0-retention-apply.mjs";
import { auditStage0RetentionDeletion } from "./adult-pilot-stage0-retention-deletion-audit.mjs";
import {
  assertRetentionPaths,
  normalizedRetentionOptions,
  parseRetentionArgs,
  stage0RetentionTargets,
} from "./adult-pilot-stage0-retention-proposal.mjs";
import {
  assertPrivatePath,
  digest,
  readFile,
  readJson,
} from "./adult-pilot-stage1-invite-ledger-proposal.mjs";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const pathKey = (target) => {
  const resolved = path.resolve(target);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
};

const snapshotFile = (target) =>
  fs.existsSync(target)
    ? digest(readFile(target, "Stage 0保持期限削除ライフサイクル監査対象"))
    : null;

const snapshot = (targets, quarantineDirectory) => ({
  files: new Map(
    [...new Set(targets.map((target) => path.resolve(target)))].map(
      (target) => [target, snapshotFile(target)],
    ),
  ),
  quarantineExists: fs.existsSync(quarantineDirectory),
  quarantineEntries: fs.existsSync(quarantineDirectory)
    ? fs.readdirSync(quarantineDirectory).sort()
    : [],
});

const assertSnapshotUnchanged = (observed, quarantineDirectory) => {
  for (const [target, expected] of observed.files) {
    if (snapshotFile(target) !== expected)
      throw new Error(
        "Stage 0保持期限削除ライフサイクル監査の対象が処理中に変更されました。",
      );
  }
  const exists = fs.existsSync(quarantineDirectory);
  const entries = exists ? fs.readdirSync(quarantineDirectory).sort() : [];
  if (
    exists !== observed.quarantineExists ||
    JSON.stringify(entries) !== JSON.stringify(observed.quarantineEntries)
  )
    throw new Error(
      "Stage 0保持期限削除ライフサイクル監査の回復領域が処理中に変更されました。",
    );
};

const assertDistinctPrivatePaths = (options, paths) => {
  const targets = assertRetentionPaths(options, options.proposalPath);
  for (const [target, label] of [
    [options.deletionAuthorizationPath, "Stage 0保持期限削除承認"],
    [options.quarantineDirectory, "Stage 0保持期限回復領域"],
    [paths.manifestPath, "Stage 0保持期限回復manifest"],
    [paths.deleteIntentPath, "Stage 0保持期限削除intent"],
    [paths.purgeIntentPath, "Stage 0保持期限purge intent"],
    [paths.receiptPath, "Stage 0保持期限削除receipt"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  const all = [
    ...targets.map((item) => item.target),
    options.proposalPath,
    options.deletionAuthorizationPath,
    options.quarantineDirectory,
    ...Object.values(paths),
  ];
  if (new Set(all.map(pathKey)).size !== all.length)
    throw new Error(
      "Stage 0保持期限削除ライフサイクル監査のpathが重複しています。",
    );
  return targets;
};

const assertOriginal = (item) => {
  if (
    !fs.existsSync(item.target) ||
    digest(readFile(item.target, "保持期限削除対象証跡")) !== item.contentSha256
  )
    throw new Error(
      "保持期限proposalの削除対象証跡が不足または変更されています。",
    );
};

const assertPayload = (item) => {
  if (
    !fs.existsSync(item.quarantinePath) ||
    digest(readFile(item.quarantinePath, "保持期限回復領域証跡")) !==
      item.contentSha256
  )
    throw new Error(
      "Stage 0保持期限回復領域証跡が不足または変更されています。",
    );
};

const readAndValidateManifest = (context) => {
  const bytes = readFile(
    context.paths.manifestPath,
    "Stage 0保持期限回復manifest",
  );
  const manifest = validateRetentionQuarantineManifest(
    readJson(bytes, "Stage 0保持期限回復manifest"),
    context,
  );
  return {
    ...context,
    manifest,
    manifestBytes: bytes,
    manifestSha256: digest(bytes),
  };
};

const readAndValidateDeleteIntent = (context) => {
  const bytes = readFile(
    context.paths.deleteIntentPath,
    "Stage 0保持期限削除intent",
  );
  const deleteIntent = validateRetentionDeleteIntent(
    readJson(bytes, "Stage 0保持期限削除intent"),
    context,
  );
  return {
    ...context,
    deleteIntent,
    deleteIntentBytes: bytes,
    deleteIntentSha256: digest(bytes),
  };
};

const readAndValidatePurgeIntent = (context) => {
  const bytes = readFile(
    context.paths.purgeIntentPath,
    "Stage 0保持期限回復領域purge intent",
  );
  const purgeIntent = validateRetentionPurgeIntent(
    readJson(bytes, "Stage 0保持期限回復領域purge intent"),
    context,
  );
  return {
    ...context,
    purgeIntent,
    purgeIntentBytes: bytes,
    purgeIntentSha256: digest(bytes),
  };
};

const assertKnownQuarantineEntries = (context) => {
  const allowed = new Set([
    path.basename(context.paths.manifestPath),
    ...context.evidence.map((item) => item.fileName),
  ]);
  const unknown = fs
    .readdirSync(context.options.quarantineDirectory)
    .filter((name) => !allowed.has(name));
  if (unknown.length)
    throw new Error("Stage 0保持期限回復領域に未承認fileがあります。");
};

const resultFor = (state, context, extra = {}) => ({
  state,
  lifecyclePhase: context.proposal.lifecyclePhase,
  evidenceCount: context.evidence.length,
  authorizationExpired:
    context.options.now.getTime() > Date.parse(context.authorization.expiresAt),
  originalsAbsent: context.evidence.filter(
    (item) => !fs.existsSync(item.target),
  ).length,
  recoveryPayloadsPresent: context.evidence.filter((item) =>
    fs.existsSync(item.quarantinePath),
  ).length,
  ...extra,
});

export const auditStage0RetentionDeletionLifecycle = (rawOptions) => {
  const options = {
    ...normalizedRetentionOptions(rawOptions),
    repositoryRoot: rawOptions.repositoryRoot ?? defaultRepositoryRoot,
  };
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("Stage 0保持期限削除ライフサイクル監査日時が不正です。");
  const paths = retentionDeletionDerivedPaths(
    options.deletionAuthorizationPath,
    options.quarantineDirectory,
  );
  const targets = assertDistinctPrivatePaths(options, paths);
  const authorizationExists = fs.existsSync(options.deletionAuthorizationPath);
  const controlsExist = Object.values(paths).some((target) =>
    fs.existsSync(target),
  );

  if (!authorizationExists) {
    if (controlsExist || fs.existsSync(options.quarantineDirectory))
      throw new Error(
        "削除承認なしでStage 0保持期限削除control fileまたは回復領域が存在します。",
      );
    const observed = snapshot(
      [
        ...targets.map((item) => item.target),
        options.proposalPath,
        options.deletionAuthorizationPath,
        ...Object.values(paths),
      ],
      options.quarantineDirectory,
    );
    const proposalResult = auditStage0RetentionProposal({
      ...options,
      beforeFinalVerification: undefined,
    });
    if (typeof options.beforeFinalVerification === "function")
      options.beforeFinalVerification();
    assertSnapshotUnchanged(observed, options.quarantineDirectory);
    return {
      state: "PROPOSAL_READY",
      lifecyclePhase: proposalResult.lifecyclePhase,
      evidenceCount: proposalResult.evidenceCount,
      authorizationExpired: false,
      originalsAbsent: 0,
      recoveryPayloadsPresent: 0,
    };
  }

  let context = readRetentionDeletionContext(options);
  const createdAt = Date.parse(context.authorization.createdAt);
  const expiresAt = Date.parse(context.authorization.expiresAt);
  if (options.now.getTime() < createdAt)
    throw new Error("Stage 0保持期限削除承認の作成日時が未来です。");
  validateStage0RetentionAuthorization(context.authorization, {
    proposal: context.proposal,
    proposalBytes: context.proposalBytes,
    proposalPath: options.proposalPath,
    authorizationPath: options.deletionAuthorizationPath,
    quarantineDirectory: options.quarantineDirectory,
    effectiveAt: Math.min(options.now.getTime(), expiresAt),
  });

  const observedTargets = [
    ...context.evidence.flatMap((item) => [item.target, item.quarantinePath]),
    options.proposalPath,
    options.deletionAuthorizationPath,
    ...Object.values(paths),
  ];
  const observed = snapshot(observedTargets, options.quarantineDirectory);

  const finish = (result) => {
    if (typeof options.beforeFinalVerification === "function")
      options.beforeFinalVerification();
    assertSnapshotUnchanged(observed, options.quarantineDirectory);
    return result;
  };

  if (fs.existsSync(paths.receiptPath)) {
    const result = auditStage0RetentionDeletion({
      ...options,
      beforeFinalVerification: undefined,
    });
    return finish({
      state: "DELETED",
      lifecyclePhase: context.proposal.lifecyclePhase,
      evidenceCount: result.evidenceCount,
      authorizationExpired: options.now.getTime() > expiresAt,
      originalsAbsent: result.evidenceCount,
      recoveryPayloadsPresent: 0,
      recoveredAfterInterruption: result.recoveredAfterInterruption,
    });
  }

  if (!fs.existsSync(paths.manifestPath)) {
    if (
      fs.existsSync(options.quarantineDirectory) ||
      fs.existsSync(paths.deleteIntentPath) ||
      fs.existsSync(paths.purgeIntentPath)
    )
      throw new Error("Stage 0保持期限削除control fileの順序が不正です。");
    for (const item of context.evidence) assertOriginal(item);
    return finish(resultFor("AUTHORIZED", context));
  }

  if (!fs.existsSync(options.quarantineDirectory))
    throw new Error("Stage 0保持期限回復領域が見つかりません。");
  context = readAndValidateManifest(context);
  assertKnownQuarantineEntries(context);

  if (!fs.existsSync(paths.deleteIntentPath)) {
    if (fs.existsSync(paths.purgeIntentPath))
      throw new Error("Stage 0保持期限削除control fileの順序が不正です。");
    for (const item of context.evidence) {
      assertOriginal(item);
      if (fs.existsSync(item.quarantinePath))
        throw new Error("削除intent前の回復領域に証跡payloadがあります。");
    }
    return finish(resultFor("MANIFEST_PREPARED", context));
  }

  context = readAndValidateDeleteIntent(context);
  if (!fs.existsSync(paths.purgeIntentPath)) {
    let originalsAbsent = 0;
    let payloadsPresent = 0;
    for (const item of context.evidence) {
      const originalExists = fs.existsSync(item.target);
      const payloadExists = fs.existsSync(item.quarantinePath);
      if (!originalExists && !payloadExists)
        throw new Error("削除対象と回復領域の両方から証跡が失われています。");
      if (originalExists) assertOriginal(item);
      else originalsAbsent += 1;
      if (payloadExists) {
        assertPayload(item);
        payloadsPresent += 1;
      }
    }
    const all = context.evidence.length;
    const state =
      originalsAbsent === 0 && payloadsPresent === 0
        ? "DELETE_PREPARED"
        : originalsAbsent === all && payloadsPresent === all
          ? "PURGE_READY"
          : "STAGING_RECOVERY_REQUIRED";
    return finish(
      resultFor(state, context, {
        originalsAbsent,
        recoveryPayloadsPresent: payloadsPresent,
      }),
    );
  }

  context = readAndValidatePurgeIntent(context);
  let payloadsPresent = 0;
  for (const item of context.evidence) {
    if (fs.existsSync(item.target))
      throw new Error("purge開始後に削除対象の原本証跡が復元されています。");
    if (fs.existsSync(item.quarantinePath)) {
      assertPayload(item);
      payloadsPresent += 1;
    }
  }
  const state =
    payloadsPresent === context.evidence.length
      ? "PURGE_PREPARED"
      : payloadsPresent === 0
        ? "RECEIPT_RECOVERY_REQUIRED"
        : "PURGE_RECOVERY_REQUIRED";
  return finish(
    resultFor(state, context, {
      originalsAbsent: context.evidence.length,
      recoveryPayloadsPresent: payloadsPresent,
    }),
  );
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
  "--deletion-authorization",
  "--quarantine-dir",
]);

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const args = parseRetentionArgs(
      process.argv.slice(2),
      valueFlags,
      new Set(),
    );
    for (const flag of [
      "--assessment",
      "--plan",
      "--artifact-evidence",
      "--bundle-evidence",
      "--package",
      "--proposal",
      "--deletion-authorization",
      "--quarantine-dir",
    ])
      if (!args.has(flag))
        throw new Error(
          "Stage 0保持期限削除ライフサイクル監査の引数が不足しています。",
        );
    const result = auditStage0RetentionDeletionLifecycle({
      assessmentPath: args.get("--assessment"),
      planPath: args.get("--plan"),
      artifactEvidencePath: args.get("--artifact-evidence"),
      bundleEvidencePath: args.get("--bundle-evidence"),
      packagePath: args.get("--package"),
      authorizationPath: args.get("--start-authorization"),
      hardwareEvidencePath: args.get("--hardware-evidence"),
      proposalPath: args.get("--proposal"),
      deletionAuthorizationPath: args.get("--deletion-authorization"),
      quarantineDirectory: args.get("--quarantine-dir"),
    });
    console.log(
      "MANGAI Desktop Adult Stage 0 retention deletion lifecycle audit",
    );
    console.log(`  State: ${result.state}`);
    console.log(`  Lifecycle phase: ${result.lifecyclePhase}`);
    console.log(`  Evidence files: ${result.evidenceCount}`);
    console.log(
      `  Authorization expired: ${result.authorizationExpired ? "yes" : "no"}`,
    );
    console.log(`  Originals absent: ${result.originalsAbsent}`);
    console.log(
      `  Recovery payloads present: ${result.recoveryPayloadsPresent}`,
    );
    console.log("  Candidate identity, content, and paths: hidden");
    console.log("  Files changed: no");
    console.log("  External action: no");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "Stage 0保持期限削除ライフサイクル監査のfile操作に失敗しました。"
        : error.message;
    console.error(
      `Stage 0 retention deletion lifecycle audit failed: ${message}`,
    );
    process.exit(1);
  }
}
