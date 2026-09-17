import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { verifyStage0OperationPackage } from "./adult-pilot-stage0-operation-package.mjs";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const sha256Pattern = /^[a-f0-9]{64}$/;
const candidateIdPattern = /^candidate-[0-9a-f]{12}$/;

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

const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");

const locationDigest = (target) => {
  const resolved = path.resolve(target);
  const canonical =
    process.platform === "win32" ? resolved.toLowerCase() : resolved;
  return digest(Buffer.from(canonical, "utf8"));
};

const exactKeys = (value, expected, label) => {
  const keys = Object.keys(value).sort();
  const required = [...expected].sort();
  if (
    keys.length !== required.length ||
    keys.some((key, index) => key !== required[index])
  )
    throw new Error(`${label}のfield構成が不正です。`);
};

const isTimestamp = (value) =>
  typeof value === "string" &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

const normalizedOptions = (options) => ({
  ...options,
  repositoryRoot: options.repositoryRoot ?? defaultRepositoryRoot,
  operationPackageVerifier:
    options.operationPackageVerifier ?? verifyStage0OperationPackage,
  now: options.now ?? new Date(),
});

const verifyBoundOperationPackage = (options) => {
  assertPrivatePath(
    options.repositoryRoot,
    options.packagePath,
    "operation package",
  );
  const before = readFile(options.packagePath, "operation package");
  const verified = options.operationPackageVerifier({
    assessmentPath: options.assessmentPath,
    planPath: options.planPath,
    artifactEvidencePath: options.artifactEvidencePath,
    bundleEvidencePath: options.bundleEvidencePath,
    packagePath: options.packagePath,
    allowHistoricalExpired: options.allowHistoricalExpired,
  });
  const after = readFile(options.packagePath, "operation package");
  if (!before.equals(after))
    throw new Error("operation packageが検証中に変更されました。");
  const operationPackage = readJson(after, "operation package");
  exactKeys(
    operationPackage,
    [
      "format",
      "version",
      "createdAt",
      "candidateId",
      "artifactVersion",
      "artifactPurpose",
      "scheduledStartAt",
      "deleteBy",
      "sources",
      "stage0Ready",
      "stage1DistributionAuthorized",
    ],
    "operation package",
  );
  if (
    operationPackage.format !==
      "mangai.desktop-adult-stage0-operation-package" ||
    operationPackage.version !== 1 ||
    !candidateIdPattern.test(operationPackage.candidateId ?? "") ||
    typeof operationPackage.artifactVersion !== "string" ||
    operationPackage.artifactVersion.length === 0 ||
    operationPackage.artifactPurpose !== "stage0_acceptance_only" ||
    !isTimestamp(operationPackage.scheduledStartAt) ||
    !isTimestamp(operationPackage.deleteBy) ||
    operationPackage.stage0Ready !== true ||
    operationPackage.stage1DistributionAuthorized !== false ||
    verified.candidateId !== operationPackage.candidateId ||
    verified.artifactVersion !== operationPackage.artifactVersion
  )
    throw new Error("operation packageの開始境界が不正です。");
  return { operationPackage, packageSha256: digest(after) };
};

const assertCurrentTime = (now, deleteBy) => {
  if (!(now instanceof Date) || Number.isNaN(now.getTime()))
    throw new Error("Stage 0開始承認日時が不正です。");
  if (now.getTime() >= Date.parse(deleteBy))
    throw new Error("Stage 0の削除期限を過ぎています。");
};

export const createStage0StartAuthorization = (rawOptions) => {
  const options = normalizedOptions(rawOptions);
  assertPrivatePath(
    options.repositoryRoot,
    options.outputPath,
    "Stage 0開始承認",
  );
  const parent = path.dirname(options.outputPath);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory())
    throw new Error("Stage 0開始承認の出力先directoryがありません。");
  if (
    options.confirmOwnerApproved !== true ||
    options.confirmAcceptanceOnly !== true ||
    options.confirmManualStop !== true ||
    options.confirmStage1Blocked !== true
  )
    throw new Error("Stage 0開始に必要な明示確認が完了していません。");
  const { operationPackage, packageSha256 } =
    verifyBoundOperationPackage(options);
  assertCurrentTime(options.now, operationPackage.deleteBy);
  const authorization = {
    format: "mangai.desktop-adult-stage0-start-authorization",
    version: 1,
    approvedAt: options.now.toISOString(),
    operationPackageSha256: packageSha256,
    operationPackageLocationSha256: locationDigest(options.packagePath),
    candidateId: operationPackage.candidateId,
    artifactVersion: operationPackage.artifactVersion,
    artifactPurpose: "stage0_acceptance_only",
    scheduledStartAt: operationPackage.scheduledStartAt,
    deleteBy: operationPackage.deleteBy,
    ownerApproved: true,
    acceptanceOnlyConfirmed: true,
    manualStopConstraintAccepted: true,
    stage0StartAuthorized: true,
    stage1DistributionAuthorized: false,
  };
  fs.writeFileSync(
    options.outputPath,
    `${JSON.stringify(authorization, null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  return authorization;
};

const validateAuthorization = (
  authorization,
  operationPackage,
  packageSha256,
) => {
  exactKeys(
    authorization,
    [
      "format",
      "version",
      "approvedAt",
      "operationPackageSha256",
      "operationPackageLocationSha256",
      "candidateId",
      "artifactVersion",
      "artifactPurpose",
      "scheduledStartAt",
      "deleteBy",
      "ownerApproved",
      "acceptanceOnlyConfirmed",
      "manualStopConstraintAccepted",
      "stage0StartAuthorized",
      "stage1DistributionAuthorized",
    ],
    "Stage 0開始承認",
  );
  if (
    authorization.format !==
      "mangai.desktop-adult-stage0-start-authorization" ||
    authorization.version !== 1 ||
    !isTimestamp(authorization.approvedAt) ||
    !sha256Pattern.test(authorization.operationPackageSha256 ?? "") ||
    authorization.operationPackageSha256 !== packageSha256 ||
    !sha256Pattern.test(authorization.operationPackageLocationSha256 ?? "") ||
    authorization.operationPackageLocationSha256 !==
      locationDigest(operationPackage.packagePath) ||
    authorization.candidateId !== operationPackage.candidateId ||
    authorization.artifactVersion !== operationPackage.artifactVersion ||
    authorization.artifactPurpose !== operationPackage.artifactPurpose ||
    authorization.scheduledStartAt !== operationPackage.scheduledStartAt ||
    authorization.deleteBy !== operationPackage.deleteBy ||
    authorization.ownerApproved !== true ||
    authorization.acceptanceOnlyConfirmed !== true ||
    authorization.manualStopConstraintAccepted !== true ||
    authorization.stage0StartAuthorized !== true ||
    authorization.stage1DistributionAuthorized !== false
  )
    throw new Error("Stage 0開始承認がoperation packageと一致しません。");
  if (
    Date.parse(authorization.approvedAt) >= Date.parse(authorization.deleteBy)
  )
    throw new Error("Stage 0開始承認の有効期間が不正です。");
};

export const verifyStage0StartAuthorization = (rawOptions) => {
  const options = normalizedOptions(rawOptions);
  assertPrivatePath(
    options.repositoryRoot,
    options.authorizationPath,
    "Stage 0開始承認",
  );
  const authorizationBefore = readFile(
    options.authorizationPath,
    "Stage 0開始承認",
  );
  const { operationPackage, packageSha256 } =
    verifyBoundOperationPackage(options);
  if (options.allowHistoricalExpired !== true)
    assertCurrentTime(options.now, operationPackage.deleteBy);
  const authorizationBytes = readFile(
    options.authorizationPath,
    "Stage 0開始承認",
  );
  if (!authorizationBefore.equals(authorizationBytes))
    throw new Error("Stage 0開始承認が検証中に変更されました。");
  const authorization = readJson(authorizationBytes, "Stage 0開始承認");
  validateAuthorization(
    authorization,
    { ...operationPackage, packagePath: options.packagePath },
    packageSha256,
  );
  return {
    operationPackage,
    packageSha256,
    authorization,
    authorizationSha256: digest(authorizationBytes),
  };
};

export const consumeStage0StartAuthorization = (rawOptions) => {
  const options = normalizedOptions(rawOptions);
  assertPrivatePath(
    options.repositoryRoot,
    options.authorizationPath,
    "Stage 0開始承認",
  );
  const receiptPath = `${options.packagePath}.stage0-start-consumed.json`;
  assertPrivatePath(
    options.repositoryRoot,
    receiptPath,
    "Stage 0開始承認receipt",
  );
  const { operationPackage, packageSha256 } =
    verifyBoundOperationPackage(options);
  assertCurrentTime(options.now, operationPackage.deleteBy);
  const authorizationBytes = readFile(
    options.authorizationPath,
    "Stage 0開始承認",
  );
  const authorization = readJson(authorizationBytes, "Stage 0開始承認");
  validateAuthorization(
    authorization,
    { ...operationPackage, packagePath: options.packagePath },
    packageSha256,
  );
  if (options.now.getTime() < Date.parse(authorization.approvedAt))
    throw new Error("Stage 0開始承認日時より前には消費できません。");
  if (options.now.getTime() < Date.parse(operationPackage.scheduledStartAt))
    throw new Error("Stage 0の予定開始日時より前には消費できません。");
  const receipt = {
    format: "mangai.desktop-adult-stage0-start-receipt",
    version: 1,
    consumedAt: options.now.toISOString(),
    authorizationSha256: digest(authorizationBytes),
    operationPackageSha256: packageSha256,
    candidateId: operationPackage.candidateId,
    artifactVersion: operationPackage.artifactVersion,
    scheduledStartAt: operationPackage.scheduledStartAt,
    deleteBy: operationPackage.deleteBy,
    stage0StartAuthorized: true,
    stage1DistributionAuthorized: false,
  };
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  return { receipt, receiptPath };
};

export const verifyConsumedStage0StartAuthorization = (rawOptions) => {
  const options = normalizedOptions(rawOptions);
  assertPrivatePath(
    options.repositoryRoot,
    options.authorizationPath,
    "Stage 0開始承認",
  );
  const receiptPath = `${options.packagePath}.stage0-start-consumed.json`;
  assertPrivatePath(
    options.repositoryRoot,
    receiptPath,
    "Stage 0開始承認receipt",
  );
  const authorizationBefore = readFile(
    options.authorizationPath,
    "Stage 0開始承認",
  );
  const receiptBefore = readFile(receiptPath, "Stage 0開始承認receipt");
  const { operationPackage, packageSha256 } =
    verifyBoundOperationPackage(options);
  if (options.allowHistoricalExpired !== true)
    assertCurrentTime(options.now, operationPackage.deleteBy);
  const authorizationBytes = readFile(
    options.authorizationPath,
    "Stage 0開始承認",
  );
  const receiptBytes = readFile(receiptPath, "Stage 0開始承認receipt");
  if (
    !authorizationBefore.equals(authorizationBytes) ||
    !receiptBefore.equals(receiptBytes)
  )
    throw new Error("Stage 0開始承認またはreceiptが検証中に変更されました。");
  const authorization = readJson(authorizationBytes, "Stage 0開始承認");
  validateAuthorization(
    authorization,
    { ...operationPackage, packagePath: options.packagePath },
    packageSha256,
  );
  const receipt = readJson(receiptBytes, "Stage 0開始承認receipt");
  exactKeys(
    receipt,
    [
      "format",
      "version",
      "consumedAt",
      "authorizationSha256",
      "operationPackageSha256",
      "candidateId",
      "artifactVersion",
      "scheduledStartAt",
      "deleteBy",
      "stage0StartAuthorized",
      "stage1DistributionAuthorized",
    ],
    "Stage 0開始承認receipt",
  );
  if (
    receipt.format !== "mangai.desktop-adult-stage0-start-receipt" ||
    receipt.version !== 1 ||
    !isTimestamp(receipt.consumedAt) ||
    receipt.authorizationSha256 !== digest(authorizationBytes) ||
    receipt.operationPackageSha256 !== packageSha256 ||
    receipt.candidateId !== operationPackage.candidateId ||
    receipt.artifactVersion !== operationPackage.artifactVersion ||
    receipt.scheduledStartAt !== operationPackage.scheduledStartAt ||
    receipt.deleteBy !== operationPackage.deleteBy ||
    receipt.stage0StartAuthorized !== true ||
    receipt.stage1DistributionAuthorized !== false ||
    Date.parse(receipt.consumedAt) < Date.parse(authorization.approvedAt) ||
    Date.parse(receipt.consumedAt) <
      Date.parse(operationPackage.scheduledStartAt) ||
    Date.parse(receipt.consumedAt) >= Date.parse(operationPackage.deleteBy)
  )
    throw new Error("Stage 0開始承認receiptが実施境界と一致しません。");
  return {
    operationPackage,
    packageSha256,
    authorization,
    authorizationSha256: digest(authorizationBytes),
    receipt,
    receiptPath,
    receiptSha256: digest(receiptBytes),
  };
};

const valueFlags = new Set([
  "--assessment",
  "--plan",
  "--artifact-evidence",
  "--bundle-evidence",
  "--package",
  "--out",
  "--authorization",
]);
const booleanFlags = new Set([
  "--confirm-owner-approved",
  "--confirm-acceptance-only",
  "--confirm-manual-stop",
  "--confirm-stage1-blocked",
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
    const mode = process.argv[2];
    if (!new Set(["create", "consume"]).has(mode))
      throw new Error("createまたはconsumeを指定してください。");
    const args = parseArgs(process.argv.slice(3));
    const requiredValues = [
      "--assessment",
      "--plan",
      "--artifact-evidence",
      "--bundle-evidence",
      "--package",
    ];
    if (requiredValues.some((flag) => !args.has(flag)))
      throw new Error("Stage 0 source引数が不足しています。");
    const common = {
      assessmentPath: args.get("--assessment"),
      planPath: args.get("--plan"),
      artifactEvidencePath: args.get("--artifact-evidence"),
      bundleEvidencePath: args.get("--bundle-evidence"),
      packagePath: args.get("--package"),
      now: new Date(),
    };
    let result;
    if (mode === "create") {
      if (!args.has("--out") || args.has("--authorization"))
        throw new Error("createに対応する出力引数を指定してください。");
      result = createStage0StartAuthorization({
        ...common,
        outputPath: args.get("--out"),
        confirmOwnerApproved: args.has("--confirm-owner-approved"),
        confirmAcceptanceOnly: args.has("--confirm-acceptance-only"),
        confirmManualStop: args.has("--confirm-manual-stop"),
        confirmStage1Blocked: args.has("--confirm-stage1-blocked"),
      });
    } else {
      if (
        !args.has("--authorization") ||
        args.has("--out") ||
        [...booleanFlags].some((flag) => args.has(flag))
      )
        throw new Error("consumeに対応する承認引数を指定してください。");
      result = consumeStage0StartAuthorization({
        ...common,
        authorizationPath: args.get("--authorization"),
      }).receipt;
    }
    console.log("MANGAI Desktop Adult Stage 0 start authorization");
    console.log(`  Mode: ${mode}`);
    console.log(`  Artifact version: ${result.artifactVersion}`);
    console.log("  Candidate identity and paths: hidden");
    console.log("  Operation package: verified");
    console.log("  Stage 0 start authorized: yes");
    console.log("  Stage 1 distribution authorized: no");
    console.log(`  Result: ${mode === "create" ? "CREATED" : "CONSUMED"}`);
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "Stage 0開始承認のfile操作に失敗しました。"
        : error.message;
    console.error(`Stage 0 start authorization failed: ${message}`);
    process.exit(1);
  }
}
