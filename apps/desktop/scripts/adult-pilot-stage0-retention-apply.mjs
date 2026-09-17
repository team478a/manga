import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { auditStage0RetentionProposal } from "./adult-pilot-stage0-retention-audit.mjs";
import { validateStage0RetentionAuthorization } from "./adult-pilot-stage0-retention-authorization.mjs";
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
const manifestFileName = "retention-quarantine-manifest.json";

export const canonicalRetentionDeletionBytes = (value) =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

const pathKey = (target) => {
  const resolved = path.resolve(target);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
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

const writeReceiptExclusive = (target, bytes) => {
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  writeExclusive(temporary, bytes);
  try {
    fs.renameSync(temporary, target);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {}
    throw error;
  }
};

export const retentionDeletionDerivedPaths = (
  deletionAuthorizationPath,
  quarantineDirectory,
) => ({
  manifestPath: path.join(quarantineDirectory, manifestFileName),
  deleteIntentPath: `${deletionAuthorizationPath}.delete-intent.json`,
  purgeIntentPath: `${deletionAuthorizationPath}.purge-intent.json`,
  receiptPath: `${deletionAuthorizationPath}.deleted.json`,
});

const quarantineFileName = (index, role) =>
  `${String(index + 1).padStart(2, "0")}-${role}.evidence`;

export const validateRetentionQuarantineManifest = (manifest, context) => {
  scanPrivateData(manifest, "Stage 0保持期限回復manifest");
  exactKeys(
    manifest,
    [
      "format",
      "version",
      "preparedAt",
      "proposalSha256",
      "authorizationSha256",
      "retentionScopeSha256",
      "evidence",
      "finalDisposition",
    ],
    "Stage 0保持期限回復manifest",
  );
  if (
    manifest.format !==
      "mangai.desktop-adult-stage0-retention-recovery-manifest" ||
    manifest.version !== 1 ||
    !isTimestamp(manifest.preparedAt) ||
    Date.parse(manifest.preparedAt) <
      Date.parse(context.authorization.createdAt) ||
    Date.parse(manifest.preparedAt) >
      Date.parse(context.authorization.expiresAt) ||
    manifest.proposalSha256 !== context.proposalSha256 ||
    manifest.authorizationSha256 !== context.authorizationSha256 ||
    manifest.retentionScopeSha256 !== context.proposal.retentionScopeSha256 ||
    !Array.isArray(manifest.evidence) ||
    manifest.evidence.length !== context.evidence.length ||
    manifest.finalDisposition !== "PURGE_BEFORE_DELETION_RECEIPT"
  )
    throw new Error("Stage 0保持期限回復manifestが承認scopeと一致しません。");
  for (const [index, item] of manifest.evidence.entries()) {
    exactKeys(
      item,
      ["role", "fileName", "contentSha256"],
      "Stage 0保持期限回復manifest.evidence",
    );
    const expected = context.evidence[index];
    if (
      item.role !== expected.role ||
      item.fileName !== expected.fileName ||
      item.contentSha256 !== expected.contentSha256 ||
      !sha256Pattern.test(item.contentSha256 ?? "")
    )
      throw new Error("Stage 0保持期限回復manifestの証跡scopeが不正です。");
  }
  return manifest;
};

export const validateRetentionDeleteIntent = (intent, context) => {
  scanPrivateData(intent, "Stage 0保持期限削除intent");
  exactKeys(
    intent,
    [
      "format",
      "version",
      "preparedAt",
      "proposalSha256",
      "authorizationSha256",
      "manifestSha256",
      "retentionScopeSha256",
      "evidenceCount",
      "action",
      "deletionAuthorized",
    ],
    "Stage 0保持期限削除intent",
  );
  const preparedAt = Date.parse(intent.preparedAt);
  if (
    intent.format !== "mangai.desktop-adult-stage0-retention-delete-intent" ||
    intent.version !== 1 ||
    !isTimestamp(intent.preparedAt) ||
    preparedAt < Date.parse(context.manifest.preparedAt) ||
    preparedAt > Date.parse(context.authorization.expiresAt) ||
    intent.proposalSha256 !== context.proposalSha256 ||
    intent.authorizationSha256 !== context.authorizationSha256 ||
    intent.manifestSha256 !== context.manifestSha256 ||
    intent.retentionScopeSha256 !== context.proposal.retentionScopeSha256 ||
    intent.evidenceCount !== context.evidence.length ||
    intent.action !== "STAGE_ORIGINALS_THEN_PURGE_RECOVERY_COPIES" ||
    intent.deletionAuthorized !== true
  )
    throw new Error("Stage 0保持期限削除intentが承認scopeと一致しません。");
  validateStage0RetentionAuthorization(context.authorization, {
    proposal: context.proposal,
    proposalBytes: context.proposalBytes,
    proposalPath: context.options.proposalPath,
    authorizationPath: context.options.deletionAuthorizationPath,
    quarantineDirectory: context.options.quarantineDirectory,
    effectiveAt: preparedAt,
  });
  return intent;
};

export const validateRetentionPurgeIntent = (intent, context) => {
  scanPrivateData(intent, "Stage 0保持期限回復領域purge intent");
  exactKeys(
    intent,
    [
      "format",
      "version",
      "purgeStartedAt",
      "proposalSha256",
      "authorizationSha256",
      "manifestSha256",
      "deleteIntentSha256",
      "evidenceCount",
      "originalEvidenceAbsent",
      "quarantineComplete",
    ],
    "Stage 0保持期限回復領域purge intent",
  );
  if (
    intent.format !== "mangai.desktop-adult-stage0-retention-purge-intent" ||
    intent.version !== 1 ||
    !isTimestamp(intent.purgeStartedAt) ||
    Date.parse(intent.purgeStartedAt) <
      Date.parse(context.deleteIntent.preparedAt) ||
    Date.parse(intent.purgeStartedAt) > context.options.now.getTime() ||
    intent.proposalSha256 !== context.proposalSha256 ||
    intent.authorizationSha256 !== context.authorizationSha256 ||
    intent.manifestSha256 !== context.manifestSha256 ||
    intent.deleteIntentSha256 !== context.deleteIntentSha256 ||
    intent.evidenceCount !== context.evidence.length ||
    intent.originalEvidenceAbsent !== true ||
    intent.quarantineComplete !== true
  )
    throw new Error("Stage 0保持期限回復領域purge intentが不正です。");
  return intent;
};

export const validateRetentionDeletionReceipt = (receipt, context) => {
  scanPrivateData(receipt, "Stage 0保持期限削除receipt");
  exactKeys(
    receipt,
    [
      "format",
      "version",
      "deletedAt",
      "proposalSha256",
      "authorizationSha256",
      "manifestSha256",
      "deleteIntentSha256",
      "purgeIntentSha256",
      "retentionScopeSha256",
      "evidenceCount",
      "recoveredAfterInterruption",
      "originalEvidenceAbsent",
      "quarantinePayloadsAbsent",
      "result",
    ],
    "Stage 0保持期限削除receipt",
  );
  if (
    receipt.format !==
      "mangai.desktop-adult-stage0-retention-deleted-receipt" ||
    receipt.version !== 1 ||
    !isTimestamp(receipt.deletedAt) ||
    Date.parse(receipt.deletedAt) <
      Date.parse(context.purgeIntent.purgeStartedAt) ||
    Date.parse(receipt.deletedAt) > context.options.now.getTime() ||
    receipt.proposalSha256 !== context.proposalSha256 ||
    receipt.authorizationSha256 !== context.authorizationSha256 ||
    receipt.manifestSha256 !== context.manifestSha256 ||
    receipt.deleteIntentSha256 !== context.deleteIntentSha256 ||
    receipt.purgeIntentSha256 !== context.purgeIntentSha256 ||
    receipt.retentionScopeSha256 !== context.proposal.retentionScopeSha256 ||
    receipt.evidenceCount !== context.evidence.length ||
    typeof receipt.recoveredAfterInterruption !== "boolean" ||
    receipt.originalEvidenceAbsent !== true ||
    receipt.quarantinePayloadsAbsent !== true ||
    receipt.result !== "DELETED"
  )
    throw new Error("Stage 0保持期限削除receiptが不正です。");
  return receipt;
};

const assertApplyPaths = (options) => {
  const targets = assertRetentionPaths(options, options.proposalPath);
  for (const [target, label] of [
    [options.deletionAuthorizationPath, "Stage 0保持期限削除承認"],
    [options.quarantineDirectory, "Stage 0保持期限回復領域"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  const paths = retentionDeletionDerivedPaths(
    options.deletionAuthorizationPath,
    options.quarantineDirectory,
  );
  for (const [target, label] of [
    [paths.manifestPath, "Stage 0保持期限回復manifest"],
    [paths.deleteIntentPath, "Stage 0保持期限削除intent"],
    [paths.purgeIntentPath, "Stage 0保持期限purge intent"],
    [paths.receiptPath, "Stage 0保持期限削除receipt"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  const keys = new Set();
  for (const target of [
    ...targets.map((item) => item.target),
    options.proposalPath,
    options.deletionAuthorizationPath,
    options.quarantineDirectory,
    ...Object.values(paths),
  ]) {
    const key = pathKey(target);
    if (keys.has(key))
      throw new Error("Stage 0保持期限削除applyのpathが重複しています。");
    keys.add(key);
  }
  return { targets, paths };
};

const readProposalAndAuthorization = (options) => {
  const proposalBytes = readFile(
    options.proposalPath,
    "Stage 0保持期限proposal",
  );
  const proposal = validateStage0RetentionProposal(
    readJson(proposalBytes, "Stage 0保持期限proposal"),
  );
  if (proposal.proposalLocationSha256 !== locationDigest(options.proposalPath))
    throw new Error("保持期限proposalの保存場所が作成時と一致しません。");
  const authorizationBytes = readFile(
    options.deletionAuthorizationPath,
    "Stage 0保持期限削除承認",
  );
  const authorization = readJson(authorizationBytes, "Stage 0保持期限削除承認");
  return {
    proposal,
    proposalBytes,
    proposalSha256: digest(proposalBytes),
    authorization,
    authorizationBytes,
    authorizationSha256: digest(authorizationBytes),
  };
};

const bindEvidenceTargets = (targets, proposal, quarantineDirectory) => {
  const byRole = new Map(targets.map((item) => [item.role, item.target]));
  const proposalRoles = new Set(proposal.evidence.map((item) => item.role));
  for (const item of targets)
    if (!proposalRoles.has(item.role) && fs.existsSync(item.target))
      throw new Error("保持期限proposalの対象外証跡が追加されています。");
  return proposal.evidence.map((item, index) => {
    const target = byRole.get(item.role);
    if (!target || locationDigest(target) !== item.locationSha256)
      throw new Error("保持期限proposalの証跡pathが指定内容と一致しません。");
    const fileName = quarantineFileName(index, item.role);
    return {
      ...item,
      target,
      fileName,
      quarantinePath: path.join(quarantineDirectory, fileName),
    };
  });
};

const assertOriginalEvidenceComplete = (evidence) => {
  for (const item of evidence) {
    if (!fs.existsSync(item.target))
      throw new Error("保持期限proposalの削除対象証跡が不足しています。");
    if (
      digest(readFile(item.target, "保持期限削除対象証跡")) !==
      item.contentSha256
    )
      throw new Error("保持期限proposalの削除対象証跡が変更されています。");
  }
};

const manifestFor = (context, preparedAt) => ({
  format: "mangai.desktop-adult-stage0-retention-recovery-manifest",
  version: 1,
  preparedAt,
  proposalSha256: context.proposalSha256,
  authorizationSha256: context.authorizationSha256,
  retentionScopeSha256: context.proposal.retentionScopeSha256,
  evidence: context.evidence.map(({ role, fileName, contentSha256 }) => ({
    role,
    fileName,
    contentSha256,
  })),
  finalDisposition: "PURGE_BEFORE_DELETION_RECEIPT",
});

const assertKnownQuarantineEntries = (context) => {
  const allowed = new Set([
    manifestFileName,
    ...context.evidence.map((item) => item.fileName),
  ]);
  const unknown = fs
    .readdirSync(context.options.quarantineDirectory)
    .filter((name) => !allowed.has(name));
  if (unknown.length)
    throw new Error("Stage 0保持期限回復領域に未承認fileがあります。");
};

const createOrReadManifest = (context, allowCreate) => {
  if (!fs.existsSync(context.options.quarantineDirectory))
    fs.mkdirSync(context.options.quarantineDirectory, { mode: 0o700 });
  const stat = fs.statSync(context.options.quarantineDirectory);
  if (!stat.isDirectory())
    throw new Error("Stage 0保持期限回復領域がdirectoryではありません。");
  if (!fs.existsSync(context.paths.manifestPath) && !allowCreate)
    throw new Error("削除中断後の回復manifestが見つかりません。");
  if (!fs.existsSync(context.paths.manifestPath))
    writeExclusive(
      context.paths.manifestPath,
      canonicalRetentionDeletionBytes(
        manifestFor(context, context.options.now.toISOString()),
      ),
    );
  const manifestBytes = readFile(
    context.paths.manifestPath,
    "Stage 0保持期限回復manifest",
  );
  const manifest = validateRetentionQuarantineManifest(
    readJson(manifestBytes, "Stage 0保持期限回復manifest"),
    context,
  );
  const withManifest = {
    ...context,
    manifest,
    manifestBytes,
    manifestSha256: digest(manifestBytes),
  };
  assertKnownQuarantineEntries(withManifest);
  return withManifest;
};

const createOrReadDeleteIntent = (context) => {
  if (!fs.existsSync(context.paths.deleteIntentPath)) {
    if (context.evidence.some((item) => fs.existsSync(item.quarantinePath)))
      throw new Error("削除intent作成前の回復領域に証跡copyがあります。");
    const intent = {
      format: "mangai.desktop-adult-stage0-retention-delete-intent",
      version: 1,
      preparedAt: context.options.now.toISOString(),
      proposalSha256: context.proposalSha256,
      authorizationSha256: context.authorizationSha256,
      manifestSha256: context.manifestSha256,
      retentionScopeSha256: context.proposal.retentionScopeSha256,
      evidenceCount: context.evidence.length,
      action: "STAGE_ORIGINALS_THEN_PURGE_RECOVERY_COPIES",
      deletionAuthorized: true,
    };
    validateRetentionDeleteIntent(intent, { ...context, deleteIntent: intent });
    writeExclusive(
      context.paths.deleteIntentPath,
      canonicalRetentionDeletionBytes(intent),
    );
  }
  const deleteIntentBytes = readFile(
    context.paths.deleteIntentPath,
    "Stage 0保持期限削除intent",
  );
  const deleteIntent = validateRetentionDeleteIntent(
    readJson(deleteIntentBytes, "Stage 0保持期限削除intent"),
    context,
  );
  return {
    ...context,
    deleteIntent,
    deleteIntentBytes,
    deleteIntentSha256: digest(deleteIntentBytes),
  };
};

const createOrReadPurgeIntent = (context) => {
  if (!fs.existsSync(context.paths.purgeIntentPath)) {
    for (const item of context.evidence) {
      if (fs.existsSync(item.target))
        throw new Error("削除対象の原本証跡がまだ残っています。");
      if (
        !fs.existsSync(item.quarantinePath) ||
        digest(readFile(item.quarantinePath, "回復領域証跡")) !==
          item.contentSha256
      )
        throw new Error("回復領域へ全証跡を固定できていません。");
    }
    const intent = {
      format: "mangai.desktop-adult-stage0-retention-purge-intent",
      version: 1,
      purgeStartedAt: context.options.now.toISOString(),
      proposalSha256: context.proposalSha256,
      authorizationSha256: context.authorizationSha256,
      manifestSha256: context.manifestSha256,
      deleteIntentSha256: context.deleteIntentSha256,
      evidenceCount: context.evidence.length,
      originalEvidenceAbsent: true,
      quarantineComplete: true,
    };
    validateRetentionPurgeIntent(intent, { ...context, purgeIntent: intent });
    writeExclusive(
      context.paths.purgeIntentPath,
      canonicalRetentionDeletionBytes(intent),
    );
  }
  const purgeIntentBytes = readFile(
    context.paths.purgeIntentPath,
    "Stage 0保持期限回復領域purge intent",
  );
  const purgeIntent = validateRetentionPurgeIntent(
    readJson(purgeIntentBytes, "Stage 0保持期限回復領域purge intent"),
    context,
  );
  return {
    ...context,
    purgeIntent,
    purgeIntentBytes,
    purgeIntentSha256: digest(purgeIntentBytes),
  };
};

const controlSnapshot = (context, includePurge) =>
  new Map(
    [
      [context.options.proposalPath, context.proposalBytes],
      [context.options.deletionAuthorizationPath, context.authorizationBytes],
      [context.paths.manifestPath, context.manifestBytes],
      [context.paths.deleteIntentPath, context.deleteIntentBytes],
      ...(includePurge
        ? [[context.paths.purgeIntentPath, context.purgeIntentBytes]]
        : []),
    ].map(([target, bytes]) => [target, digest(bytes)]),
  );

const assertControlsUnchanged = (observed) => {
  for (const [target, expected] of observed)
    if (
      !fs.existsSync(target) ||
      digest(readFile(target, "保持期限削除control file")) !== expected
    )
      throw new Error("保持期限削除control fileが処理中に変更されました。");
};

const stageOriginalEvidence = (context) => {
  const controls = controlSnapshot(context, false);
  for (const [index, item] of context.evidence.entries()) {
    assertControlsUnchanged(controls);
    const sourceExists = fs.existsSync(item.target);
    const quarantineExists = fs.existsSync(item.quarantinePath);
    if (!sourceExists && !quarantineExists)
      throw new Error("削除対象と回復領域の両方から証跡が失われています。");
    if (
      sourceExists &&
      digest(readFile(item.target, "保持期限削除対象証跡")) !==
        item.contentSha256
    )
      throw new Error("保持期限削除対象証跡が変更されています。");
    if (
      quarantineExists &&
      digest(readFile(item.quarantinePath, "回復領域証跡")) !==
        item.contentSha256
    )
      throw new Error("回復領域証跡が変更されています。");
    if (!quarantineExists) {
      writeExclusive(
        item.quarantinePath,
        readFile(item.target, "保持期限削除対象証跡"),
      );
      if (
        digest(readFile(item.quarantinePath, "回復領域証跡")) !==
        item.contentSha256
      )
        throw new Error("回復領域へ証跡を正しく固定できませんでした。");
    }
    if (sourceExists) {
      if (typeof context.options.beforeOriginalRemoval === "function")
        context.options.beforeOriginalRemoval({ role: item.role, index });
      assertControlsUnchanged(controls);
      if (
        !fs.existsSync(item.target) ||
        digest(readFile(item.target, "保持期限削除対象証跡")) !==
          item.contentSha256
      )
        throw new Error("保持期限削除対象証跡が削除直前に変更されました。");
      if (
        !fs.existsSync(item.quarantinePath) ||
        digest(readFile(item.quarantinePath, "回復領域証跡")) !==
          item.contentSha256
      )
        throw new Error("回復領域証跡が原本削除直前に変更されました。");
      fs.unlinkSync(item.target);
      if (fs.existsSync(item.target))
        throw new Error("保持期限削除対象証跡を隔離できませんでした。");
      if (typeof context.options.afterOriginalRemoval === "function")
        context.options.afterOriginalRemoval({ role: item.role, index });
    }
  }
};

const purgeQuarantineEvidence = (context) => {
  const controls = controlSnapshot(context, true);
  for (const [index, item] of context.evidence.entries()) {
    assertControlsUnchanged(controls);
    if (fs.existsSync(item.target))
      throw new Error("purge開始後に削除対象の原本証跡が復元されています。");
    if (fs.existsSync(item.quarantinePath)) {
      if (
        digest(readFile(item.quarantinePath, "回復領域証跡")) !==
        item.contentSha256
      )
        throw new Error("回復領域証跡がpurge前に変更されています。");
      fs.unlinkSync(item.quarantinePath);
    }
    if (fs.existsSync(item.quarantinePath))
      throw new Error("回復領域証跡をpurgeできませんでした。");
    if (typeof context.options.afterQuarantinePurge === "function")
      context.options.afterQuarantinePurge({ role: item.role, index });
  }
  assertControlsUnchanged(controls);
  assertKnownQuarantineEntries(context);
};

const writeDeletionReceipt = (context, recovered) => {
  const receipt = {
    format: "mangai.desktop-adult-stage0-retention-deleted-receipt",
    version: 1,
    deletedAt: context.options.now.toISOString(),
    proposalSha256: context.proposalSha256,
    authorizationSha256: context.authorizationSha256,
    manifestSha256: context.manifestSha256,
    deleteIntentSha256: context.deleteIntentSha256,
    purgeIntentSha256: context.purgeIntentSha256,
    retentionScopeSha256: context.proposal.retentionScopeSha256,
    evidenceCount: context.evidence.length,
    recoveredAfterInterruption: recovered,
    originalEvidenceAbsent: true,
    quarantinePayloadsAbsent: true,
    result: "DELETED",
  };
  validateRetentionDeletionReceipt(receipt, context);
  writeReceiptExclusive(
    context.paths.receiptPath,
    canonicalRetentionDeletionBytes(receipt),
  );
  return receipt;
};

export const readRetentionDeletionContext = (rawOptions) => {
  const options = {
    ...normalizedRetentionOptions(rawOptions),
    repositoryRoot: rawOptions.repositoryRoot ?? defaultRepositoryRoot,
  };
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("Stage 0保持期限削除日時が不正です。");
  const { targets, paths } = assertApplyPaths(options);
  const base = {
    options,
    paths,
    ...readProposalAndAuthorization(options),
  };
  const evidence = bindEvidenceTargets(
    targets,
    base.proposal,
    options.quarantineDirectory,
  );
  return { ...base, evidence };
};

export const applyStage0RetentionDeletion = (rawOptions) => {
  const contextBase = readRetentionDeletionContext(rawOptions);
  const { options, paths } = contextBase;
  if (
    options.confirmAuthorizationReviewed !== true ||
    options.confirmQuarantineRecovery !== true ||
    options.confirmExactEvidenceDeletion !== true ||
    options.confirmFinalQuarantinePurge !== true
  )
    throw new Error("Stage 0保持期限削除applyの明示確認が不足しています。");
  if (fs.existsSync(paths.receiptPath))
    throw new Error("このStage 0保持期限削除承認は適用済みです。");

  const recovering = fs.existsSync(paths.deleteIntentPath);
  if (recovering && !fs.existsSync(options.quarantineDirectory))
    throw new Error("削除中断後の回復領域が見つかりません。");
  if (!recovering) {
    auditStage0RetentionProposal({
      ...options,
      proposalPath: options.proposalPath,
    });
    validateStage0RetentionAuthorization(contextBase.authorization, {
      proposal: contextBase.proposal,
      proposalBytes: contextBase.proposalBytes,
      proposalPath: options.proposalPath,
      authorizationPath: options.deletionAuthorizationPath,
      quarantineDirectory: options.quarantineDirectory,
      effectiveAt: options.now.getTime(),
    });
    assertOriginalEvidenceComplete(contextBase.evidence);
  }

  let context = createOrReadManifest(contextBase, !recovering);
  if (typeof options.afterManifest === "function") options.afterManifest();
  context = createOrReadDeleteIntent(context);
  if (typeof options.afterDeleteIntent === "function")
    options.afterDeleteIntent();
  if (!fs.existsSync(paths.purgeIntentPath)) stageOriginalEvidence(context);
  context = createOrReadPurgeIntent(context);
  if (typeof options.afterPurgeIntent === "function")
    options.afterPurgeIntent();
  purgeQuarantineEvidence(context);
  for (const item of context.evidence)
    if (fs.existsSync(item.target) || fs.existsSync(item.quarantinePath))
      throw new Error("Stage 0保持期限削除結果を確認できませんでした。");
  return {
    receipt: writeDeletionReceipt(context, recovering),
    recovered: recovering,
    evidenceCount: context.evidence.length,
  };
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
const booleanFlags = new Set([
  "--confirm-authorization-reviewed",
  "--confirm-quarantine-recovery",
  "--confirm-exact-evidence-deletion",
  "--confirm-final-quarantine-purge",
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
      "--deletion-authorization",
      "--quarantine-dir",
    ])
      if (!args.has(flag))
        throw new Error("Stage 0保持期限削除applyの引数が不足しています。");
    const result = applyStage0RetentionDeletion({
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
      confirmAuthorizationReviewed: args.has(
        "--confirm-authorization-reviewed",
      ),
      confirmQuarantineRecovery: args.has("--confirm-quarantine-recovery"),
      confirmExactEvidenceDeletion: args.has(
        "--confirm-exact-evidence-deletion",
      ),
      confirmFinalQuarantinePurge: args.has("--confirm-final-quarantine-purge"),
    });
    console.log("MANGAI Desktop Adult Stage 0 retention deletion apply");
    console.log(`  Evidence files deleted: ${result.evidenceCount}`);
    console.log(`  Recovery resumed: ${result.recovered ? "yes" : "no"}`);
    console.log("  Recovery payloads purged: yes");
    console.log("  Candidate identity, content, and paths: hidden");
    console.log(
      "  Runtime, model, generation, distribution, or credit action: no",
    );
    console.log("  Result: DELETED");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "Stage 0保持期限削除applyのfile操作に失敗しました。"
        : error.message;
    console.error(`Stage 0 retention deletion apply failed: ${message}`);
    process.exit(1);
  }
}
