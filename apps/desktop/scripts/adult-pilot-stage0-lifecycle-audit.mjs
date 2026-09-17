import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  validateStage0HardwareEvidence,
  verifyStage0CompletionEvidenceForImport,
} from "./adult-pilot-stage0-completion-evidence.mjs";
import { verifyStage0OperationPackage } from "./adult-pilot-stage0-operation-package.mjs";
import {
  verifyConsumedStage0StartAuthorization,
  verifyStage0StartAuthorization,
} from "./adult-pilot-stage0-start-authorization.mjs";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");

const isInside = (parent, child) => {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

const assertPrivatePath = (repositoryRoot, target, label) => {
  if (!path.isAbsolute(target ?? "") || target.startsWith("\\\\"))
    throw new Error(
      `${label}はローカルドライブ上の絶対pathで指定してください。`,
    );
  if (isInside(repositoryRoot, target))
    throw new Error(`${label}はGit管理外のアクセス制限領域に置いてください。`);
};

const readFile = (target, label) => {
  try {
    const bytes = fs.readFileSync(target);
    if (!bytes.length) throw new Error();
    return bytes;
  } catch {
    throw new Error(`${label}を読み取れませんでした。`);
  }
};

const readJson = (bytes, label) => {
  try {
    const value = JSON.parse(bytes.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new Error(`${label}のJSONが不正です。`);
  }
};

const existingSnapshot = (targets) =>
  new Map(
    targets.filter(Boolean).map((target) => {
      const resolved = path.resolve(target);
      return [
        resolved,
        fs.existsSync(resolved) ? digest(readFile(resolved, "監査対象")) : null,
      ];
    }),
  );

const assertSnapshotUnchanged = (before) => {
  for (const [target, expected] of before) {
    const exists = fs.existsSync(target);
    if (
      (expected === null && exists) ||
      (expected !== null &&
        (!exists || digest(readFile(target, "監査対象")) !== expected))
    )
      throw new Error("Stage 0証跡がライフサイクル監査中に変更されました。");
  }
};

const assertNoNewDerivedEvidence = (targets) => {
  for (const target of targets)
    if (fs.existsSync(target))
      throw new Error("前工程なしのStage 0証跡を検出しました。");
};

const commonVerifierOptions = (options) => ({
  repositoryRoot: options.repositoryRoot,
  assessmentPath: options.assessmentPath,
  planPath: options.planPath,
  artifactEvidencePath: options.artifactEvidencePath,
  bundleEvidencePath: options.bundleEvidencePath,
  packagePath: options.packagePath,
  operationPackageVerifier: options.operationPackageVerifier,
  allowHistoricalExpired: true,
  now: options.now,
});

export const auditAdultPilotStage0Lifecycle = (rawOptions) => {
  const options = {
    ...rawOptions,
    repositoryRoot: rawOptions.repositoryRoot ?? defaultRepositoryRoot,
    operationPackageVerifier:
      rawOptions.operationPackageVerifier ?? verifyStage0OperationPackage,
    now: rawOptions.now ?? new Date(),
  };
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("Stage 0ライフサイクル監査日時が不正です。");
  for (const [label, target] of [
    ["候補assessment", options.assessmentPath],
    ["Stage 0計画", options.planPath],
    ["署名Artifact証跡", options.artifactEvidencePath],
    ["固定Bundle証跡", options.bundleEvidencePath],
    ["operation package", options.packagePath],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  if (options.authorizationPath)
    assertPrivatePath(
      options.repositoryRoot,
      options.authorizationPath,
      "Stage 0開始承認",
    );
  if (options.hardwareEvidencePath)
    assertPrivatePath(
      options.repositoryRoot,
      options.hardwareEvidencePath,
      "Stage 0実機証跡",
    );

  const receiptPath = `${options.packagePath}.stage0-start-consumed.json`;
  const completionPath = `${options.packagePath}.stage0-completion.json`;
  const targets = [
    options.assessmentPath,
    options.planPath,
    options.artifactEvidencePath,
    options.bundleEvidencePath,
    options.packagePath,
    options.authorizationPath,
    receiptPath,
    options.hardwareEvidencePath,
    completionPath,
  ];
  const before = existingSnapshot(targets);
  const operationPackage = options.operationPackageVerifier({
    assessmentPath: options.assessmentPath,
    planPath: options.planPath,
    artifactEvidencePath: options.artifactEvidencePath,
    bundleEvidencePath: options.bundleEvidencePath,
    packagePath: options.packagePath,
    allowHistoricalExpired: true,
  });
  const deleteBy = Date.parse(operationPackage.deleteBy ?? "");
  if (Number.isNaN(deleteBy))
    throw new Error("operation packageの削除期限が不正です。");

  const receiptExists = fs.existsSync(receiptPath);
  const completionExists = fs.existsSync(completionPath);
  if (!options.authorizationPath) {
    assertNoNewDerivedEvidence([receiptPath, completionPath]);
    if (options.hardwareEvidencePath)
      throw new Error("開始承認なしのStage 0実機証跡は監査できません。");
    if (typeof options.beforeFinalVerification === "function")
      options.beforeFinalVerification();
    assertSnapshotUnchanged(before);
    return {
      phase: "OPERATION_PACKAGE",
      state: options.now.getTime() >= deleteBy ? "EXPIRED" : "READY",
      acceptancePassed: false,
      retentionActionRequired: options.now.getTime() >= deleteBy,
    };
  }

  const authorization = verifyStage0StartAuthorization({
    ...commonVerifierOptions(options),
    authorizationPath: options.authorizationPath,
  });
  if (!receiptExists) {
    if (completionExists || options.hardwareEvidencePath)
      throw new Error("開始承認の消費前に後続のStage 0証跡があります。");
    if (typeof options.beforeFinalVerification === "function")
      options.beforeFinalVerification();
    assertSnapshotUnchanged(before);
    return {
      phase: "START_AUTHORIZATION",
      state: options.now.getTime() >= deleteBy ? "EXPIRED" : "PREPARED",
      acceptancePassed: false,
      retentionActionRequired: options.now.getTime() >= deleteBy,
    };
  }

  const consumed = verifyConsumedStage0StartAuthorization({
    ...commonVerifierOptions(options),
    authorizationPath: options.authorizationPath,
  });
  if (
    consumed.authorizationSha256 !== undefined &&
    consumed.authorizationSha256 !== authorization.authorizationSha256
  )
    throw new Error("Stage 0開始承認の連結が一致しません。");
  if (completionExists && !options.hardwareEvidencePath)
    throw new Error("Stage 0完了証跡には実機証跡の指定が必要です。");

  let acceptancePassed = false;
  let phase = "ACCEPTANCE";
  if (options.hardwareEvidencePath) {
    const hardwareBytes = readFile(
      options.hardwareEvidencePath,
      "Stage 0実機証跡",
    );
    validateStage0HardwareEvidence(
      readJson(hardwareBytes, "Stage 0実機証跡"),
      consumed.receipt.consumedAt,
      consumed.operationPackage.deleteBy,
    );
  }
  if (completionExists) {
    const completion = verifyStage0CompletionEvidenceForImport({
      repositoryRoot: options.repositoryRoot,
      completionPath,
      hardwareEvidencePath: options.hardwareEvidencePath,
      packagePath: options.packagePath,
    }).completion;
    if (
      completion.candidateId !== consumed.operationPackage.candidateId ||
      completion.artifactVersion !==
        consumed.operationPackage.artifactVersion ||
      completion.operationPackageSha256 !== consumed.packageSha256 ||
      completion.startReceiptSha256 !== consumed.receiptSha256 ||
      completion.consumedAt !== consumed.receipt.consumedAt ||
      completion.deleteBy !== consumed.operationPackage.deleteBy
    )
      throw new Error("Stage 0完了証跡が開始済みsessionと一致しません。");
    acceptancePassed = true;
    phase = "COMPLETION";
  }

  if (typeof options.beforeFinalVerification === "function")
    options.beforeFinalVerification();
  assertSnapshotUnchanged(before);
  const expired = options.now.getTime() >= deleteBy;
  return {
    phase,
    state: expired ? "EXPIRED" : acceptancePassed ? "COMPLETED" : "IN_PROGRESS",
    acceptancePassed,
    retentionActionRequired: expired,
  };
};

const valueFlags = new Set([
  "--assessment",
  "--plan",
  "--artifact-evidence",
  "--bundle-evidence",
  "--package",
  "--authorization",
  "--hardware-evidence",
]);
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
    for (const flag of [
      "--assessment",
      "--plan",
      "--artifact-evidence",
      "--bundle-evidence",
      "--package",
    ])
      if (!args.has(flag))
        throw new Error("Stage 0ライフサイクル監査の引数が不足しています。");
    const result = auditAdultPilotStage0Lifecycle({
      assessmentPath: args.get("--assessment"),
      planPath: args.get("--plan"),
      artifactEvidencePath: args.get("--artifact-evidence"),
      bundleEvidencePath: args.get("--bundle-evidence"),
      packagePath: args.get("--package"),
      authorizationPath: args.get("--authorization"),
      hardwareEvidencePath: args.get("--hardware-evidence"),
    });
    console.log("MANGAI Desktop Adult Stage 0 lifecycle audit");
    console.log(`  Phase: ${result.phase}`);
    console.log(`  State: ${result.state}`);
    console.log(
      `  Acceptance passed: ${result.acceptancePassed ? "yes" : "no"}`,
    );
    console.log(
      `  Retention action required: ${result.retentionActionRequired ? "yes" : "no"}`,
    );
    console.log("  Candidate identity and paths: hidden");
    console.log("  Files changed: no");
    console.log("  External action: no");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "Stage 0ライフサイクル監査のfile操作に失敗しました。"
        : error.message;
    console.error(`Adult Stage 0 lifecycle audit failed: ${message}`);
    process.exit(1);
  }
}
