import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { verifyConsumedStage0StartAuthorization } from "./adult-pilot-stage0-start-authorization.mjs";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const sha256Pattern = /^[a-f0-9]{64}$/;
const candidateIdPattern = /^candidate-[0-9a-f]{12}$/;
const requiredOperations = [
  "text_to_image",
  "image_to_image",
  "controlnet",
  "inpainting",
];

const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");

const locationDigest = (target) => {
  const resolved = path.resolve(target);
  const canonical =
    process.platform === "win32" ? resolved.toLowerCase() : resolved;
  return digest(Buffer.from(canonical, "utf8"));
};

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

const exactKeys = (value, expected, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}のfield構成が不正です。`);
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

export const validateStage0HardwareEvidence = (
  evidence,
  consumedAt,
  deleteBy,
) => {
  exactKeys(
    evidence,
    [
      "format",
      "version",
      "profile",
      "hardware",
      "checkedAt",
      "projectIdSha256",
      "operations",
      "export",
    ],
    "Stage 0実機証跡",
  );
  exactKeys(
    evidence.hardware,
    ["totalRamBytes", "gpuName", "dedicatedVramMb"],
    "Stage 0実機hardware",
  );
  exactKeys(
    evidence.export,
    ["pdfSha256", "salesPackageSha256", "createdAt"],
    "Stage 0実機export",
  );
  if (
    evidence.format !== "mangai.phase5-hardware-evidence" ||
    evidence.version !== 1 ||
    evidence.profile !== "vram_12gb" ||
    !Number.isSafeInteger(evidence.hardware.totalRamBytes) ||
    evidence.hardware.totalRamBytes <= 0 ||
    typeof evidence.hardware.gpuName !== "string" ||
    !evidence.hardware.gpuName.trim() ||
    evidence.hardware.gpuName.length > 500 ||
    !Number.isSafeInteger(evidence.hardware.dedicatedVramMb) ||
    evidence.hardware.dedicatedVramMb < 12 * 1024 ||
    evidence.hardware.dedicatedVramMb >= 16 * 1024 ||
    !isTimestamp(evidence.checkedAt) ||
    !sha256Pattern.test(evidence.projectIdSha256 ?? "") ||
    !sha256Pattern.test(evidence.export.pdfSha256 ?? "") ||
    !sha256Pattern.test(evidence.export.salesPackageSha256 ?? "") ||
    !isTimestamp(evidence.export.createdAt) ||
    !Array.isArray(evidence.operations) ||
    evidence.operations.length !== requiredOperations.length
  )
    throw new Error("Stage 0実機証跡の形式または12GB条件が不正です。");
  const seen = new Set();
  for (const item of evidence.operations) {
    exactKeys(
      item,
      ["operation", "result", "outputSha256", "completedAt"],
      "Stage 0実機operation",
    );
    if (
      !requiredOperations.includes(item.operation) ||
      seen.has(item.operation) ||
      item.result !== "passed" ||
      !sha256Pattern.test(item.outputSha256 ?? "") ||
      !isTimestamp(item.completedAt)
    )
      throw new Error("Stage 0実機operation証跡が不正です。");
    seen.add(item.operation);
  }
  if (requiredOperations.some((operation) => !seen.has(operation)))
    throw new Error("Stage 0実機operation証跡が不足しています。");
  if (consumedAt !== undefined && deleteBy !== undefined) {
    const started = Date.parse(consumedAt);
    const checked = Date.parse(evidence.checkedAt);
    const deadline = Date.parse(deleteBy);
    const evidenceTimes = [
      ...evidence.operations.map((item) => Date.parse(item.completedAt)),
      Date.parse(evidence.export.createdAt),
    ];
    if (
      !isTimestamp(consumedAt) ||
      !isTimestamp(deleteBy) ||
      checked < started ||
      checked >= deadline ||
      evidenceTimes.some((value) => value < started || value > checked)
    )
      throw new Error("Stage 0開始消費後の実機証跡だけを使用できます。");
  }
  return evidence;
};

const validateCompletion = (
  completion,
  completionBytes,
  hardwareEvidence,
  hardwareBytes,
  hardwareEvidencePath,
) => {
  exactKeys(
    completion,
    [
      "format",
      "version",
      "completedAt",
      "operationPackageSha256",
      "operationPackageLocationSha256",
      "startReceiptSha256",
      "hardwareEvidenceSha256",
      "hardwareEvidenceLocationSha256",
      "candidateId",
      "artifactVersion",
      "artifactPurpose",
      "profile",
      "consumedAt",
      "checkedAt",
      "deleteBy",
      "stage0AcceptancePassed",
      "stage1DistributionAuthorized",
    ],
    "Stage 0完了証跡",
  );
  if (
    completion.format !== "mangai.desktop-adult-stage0-completion-evidence" ||
    completion.version !== 1 ||
    !isTimestamp(completion.completedAt) ||
    !sha256Pattern.test(completion.operationPackageSha256 ?? "") ||
    !sha256Pattern.test(completion.operationPackageLocationSha256 ?? "") ||
    !sha256Pattern.test(completion.startReceiptSha256 ?? "") ||
    completion.hardwareEvidenceSha256 !== digest(hardwareBytes) ||
    completion.hardwareEvidenceLocationSha256 !==
      locationDigest(hardwareEvidencePath) ||
    !candidateIdPattern.test(completion.candidateId ?? "") ||
    typeof completion.artifactVersion !== "string" ||
    !completion.artifactVersion ||
    completion.artifactPurpose !== "stage0_acceptance_only" ||
    completion.profile !== "vram_12gb" ||
    completion.profile !== hardwareEvidence.profile ||
    !isTimestamp(completion.consumedAt) ||
    completion.checkedAt !== hardwareEvidence.checkedAt ||
    !isTimestamp(completion.deleteBy) ||
    Date.parse(completion.completedAt) < Date.parse(completion.checkedAt) ||
    Date.parse(completion.completedAt) >= Date.parse(completion.deleteBy) ||
    completion.stage0AcceptancePassed !== true ||
    completion.stage1DistributionAuthorized !== false
  )
    throw new Error("Stage 0完了証跡が実機証跡と一致しません。");
  validateStage0HardwareEvidence(
    hardwareEvidence,
    completion.consumedAt,
    completion.deleteBy,
  );
  return {
    completion,
    completionSha256: digest(completionBytes),
    hardwareEvidence,
  };
};

const normalizedOptions = (options) => ({
  ...options,
  repositoryRoot: options.repositoryRoot ?? defaultRepositoryRoot,
  now: options.now ?? new Date(),
  consumedAuthorizationVerifier:
    options.consumedAuthorizationVerifier ??
    verifyConsumedStage0StartAuthorization,
});

export const createStage0CompletionEvidence = (rawOptions) => {
  const options = normalizedOptions(rawOptions);
  assertPrivatePath(
    options.repositoryRoot,
    options.hardwareEvidencePath,
    "Stage 0実機証跡",
  );
  assertPrivatePath(
    options.repositoryRoot,
    options.packagePath,
    "operation package",
  );
  const outputPath = `${options.packagePath}.stage0-completion.json`;
  assertPrivatePath(options.repositoryRoot, outputPath, "Stage 0完了証跡");
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("Stage 0完了日時が不正です。");
  const hardwareBefore = readFile(
    options.hardwareEvidencePath,
    "Stage 0実機証跡",
  );
  const verified = options.consumedAuthorizationVerifier({
    repositoryRoot: options.repositoryRoot,
    assessmentPath: options.assessmentPath,
    planPath: options.planPath,
    artifactEvidencePath: options.artifactEvidencePath,
    bundleEvidencePath: options.bundleEvidencePath,
    packagePath: options.packagePath,
    authorizationPath: options.authorizationPath,
    operationPackageVerifier: options.operationPackageVerifier,
    now: options.now,
  });
  const hardwareBytes = readFile(
    options.hardwareEvidencePath,
    "Stage 0実機証跡",
  );
  if (!hardwareBefore.equals(hardwareBytes))
    throw new Error("Stage 0実機証跡が検証中に変更されました。");
  const hardwareEvidence = validateStage0HardwareEvidence(
    readJson(hardwareBytes, "Stage 0実機証跡"),
    verified.receipt.consumedAt,
    verified.operationPackage.deleteBy,
  );
  if (
    options.now.getTime() < Date.parse(hardwareEvidence.checkedAt) ||
    options.now.getTime() >= Date.parse(verified.operationPackage.deleteBy)
  )
    throw new Error("Stage 0完了日時が実施境界の範囲外です。");
  const completion = {
    format: "mangai.desktop-adult-stage0-completion-evidence",
    version: 1,
    completedAt: options.now.toISOString(),
    operationPackageSha256: verified.packageSha256,
    operationPackageLocationSha256: locationDigest(options.packagePath),
    startReceiptSha256: verified.receiptSha256,
    hardwareEvidenceSha256: digest(hardwareBytes),
    hardwareEvidenceLocationSha256: locationDigest(
      options.hardwareEvidencePath,
    ),
    candidateId: verified.operationPackage.candidateId,
    artifactVersion: verified.operationPackage.artifactVersion,
    artifactPurpose: "stage0_acceptance_only",
    profile: "vram_12gb",
    consumedAt: verified.receipt.consumedAt,
    checkedAt: hardwareEvidence.checkedAt,
    deleteBy: verified.operationPackage.deleteBy,
    stage0AcceptancePassed: true,
    stage1DistributionAuthorized: false,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(completion, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  return { completion, outputPath };
};

export const verifyStage0CompletionEvidenceForImport = (rawOptions) => {
  const repositoryRoot = rawOptions.repositoryRoot ?? defaultRepositoryRoot;
  assertPrivatePath(
    repositoryRoot,
    rawOptions.packagePath,
    "operation package",
  );
  assertPrivatePath(
    repositoryRoot,
    rawOptions.completionPath,
    "Stage 0完了証跡",
  );
  assertPrivatePath(
    repositoryRoot,
    rawOptions.hardwareEvidencePath,
    "Stage 0実機証跡",
  );
  const expectedCompletionPath = `${path.resolve(rawOptions.packagePath)}.stage0-completion.json`;
  const actualCompletionPath = path.resolve(rawOptions.completionPath);
  const sameCompletionPath =
    process.platform === "win32"
      ? actualCompletionPath.toLowerCase() ===
        expectedCompletionPath.toLowerCase()
      : actualCompletionPath === expectedCompletionPath;
  if (!sameCompletionPath)
    throw new Error(
      "Stage 0完了証跡は元operation packageの隣に固定してください。",
    );
  const packageBytes = readFile(rawOptions.packagePath, "operation package");
  const completionBytes = readFile(
    rawOptions.completionPath,
    "Stage 0完了証跡",
  );
  const hardwareBytes = readFile(
    rawOptions.hardwareEvidencePath,
    "Stage 0実機証跡",
  );
  const verified = validateCompletion(
    readJson(completionBytes, "Stage 0完了証跡"),
    completionBytes,
    validateStage0HardwareEvidence(readJson(hardwareBytes, "Stage 0実機証跡")),
    hardwareBytes,
    rawOptions.hardwareEvidencePath,
  );
  if (
    verified.completion.operationPackageSha256 !== digest(packageBytes) ||
    verified.completion.operationPackageLocationSha256 !==
      locationDigest(rawOptions.packagePath)
  )
    throw new Error("Stage 0完了証跡が元operation packageと一致しません。");
  return verified;
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
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!valueFlags.has(flag) || !value || value.startsWith("--"))
      throw new Error("未対応または値のない引数があります。");
    if (parsed.has(flag)) throw new Error("同じ引数を複数回指定できません。");
    parsed.set(flag, value);
  }
  return parsed;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if ([...valueFlags].some((flag) => !args.has(flag)))
      throw new Error("Stage 0完了証跡のsource引数が不足しています。");
    const { completion } = createStage0CompletionEvidence({
      assessmentPath: args.get("--assessment"),
      planPath: args.get("--plan"),
      artifactEvidencePath: args.get("--artifact-evidence"),
      bundleEvidencePath: args.get("--bundle-evidence"),
      packagePath: args.get("--package"),
      authorizationPath: args.get("--authorization"),
      hardwareEvidencePath: args.get("--hardware-evidence"),
    });
    console.log("MANGAI Desktop Adult Stage 0 completion evidence");
    console.log(`  Artifact version: ${completion.artifactVersion}`);
    console.log(`  Hardware profile: ${completion.profile}`);
    console.log("  Candidate identity and paths: hidden");
    console.log("  Stage 0 acceptance passed: yes");
    console.log("  Stage 1 distribution authorized: no");
    console.log("  Result: CREATED");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "Stage 0完了証跡のfile操作に失敗しました。"
        : error.message;
    console.error(`Stage 0 completion evidence failed: ${message}`);
    process.exit(1);
  }
}
