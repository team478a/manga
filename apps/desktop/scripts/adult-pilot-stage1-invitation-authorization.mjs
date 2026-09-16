import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const sha256Pattern = /^[a-f0-9]{64}$/;
const candidateIdPattern = /^candidate-[a-f0-9]{12}$/;
const monitorIdPattern = /^monitor-[a-f0-9]{12}$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-beta\.\d+)?$/;
const forbiddenKeys =
  /^(name|email|address|phone|prompt|negativePrompt|image|mask|projectName|deviceName|hostname|serialNumber|ipAddress|macAddress|absolutePath|content|notes?)$/i;
const emailPattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const absolutePathPattern =
  /(?:[a-z]:\\|\\\\[^\\]+\\|file:\/\/|\/(?:home|users|var|tmp)\/)/i;

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
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (
    actual.length !== required.length ||
    actual.some((key, index) => key !== required[index])
  )
    throw new Error(`${label}のfield構成が不正です。`);
};

const isTimestamp = (value) =>
  typeof value === "string" &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

const scanPrivateData = (value, location) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      scanPrivateData(item, `${location}[${index}]`),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKeys.test(key))
        throw new Error(`${location}.${key}は保存禁止fieldです。`);
      scanPrivateData(item, `${location}.${key}`);
    }
    return;
  }
  if (
    typeof value === "string" &&
    (emailPattern.test(value) || absolutePathPattern.test(value))
  )
    throw new Error(`${location}に個人情報またはlocal pathを保存できません。`);
};

const validateAssessment = (assessment) => {
  scanPrivateData(assessment, "候補assessment");
  exactKeys(
    assessment,
    [
      "format",
      "version",
      "candidateId",
      "evaluatedAt",
      "eligible",
      "environment",
      "failedChecks",
      "warnings",
      "distributionAuthorized",
      "nextStep",
    ],
    "候補assessment",
  );
  exactKeys(
    assessment.environment,
    ["windows", "gpuVendor", "vramBand", "ramBand", "freeDiskBand"],
    "候補assessment.environment",
  );
  if (
    assessment.format !== "mangai.desktop-adult-technical-monitor-assessment" ||
    assessment.version !== 1 ||
    !candidateIdPattern.test(assessment.candidateId ?? "") ||
    !isTimestamp(assessment.evaluatedAt) ||
    assessment.eligible !== true ||
    assessment.environment.windows !== "windows_11" ||
    assessment.environment.gpuVendor !== "nvidia" ||
    !["12gb", "16gb_or_more"].includes(assessment.environment.vramBand) ||
    !Array.isArray(assessment.failedChecks) ||
    assessment.failedChecks.length !== 0 ||
    !Array.isArray(assessment.warnings) ||
    assessment.distributionAuthorized !== false ||
    assessment.nextStep !==
      "signed_acceptance_artifact_and_release_readiness_required"
  )
    throw new Error("候補assessmentはStage 1対象として適格ではありません。");
  return assessment;
};

const validateCompletion = (completion) => {
  scanPrivateData(completion, "Stage 0完了証跡");
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
    !candidateIdPattern.test(completion.candidateId ?? "") ||
    !versionPattern.test(completion.artifactVersion ?? "") ||
    completion.artifactPurpose !== "stage0_acceptance_only" ||
    completion.profile !== "vram_12gb" ||
    !isTimestamp(completion.consumedAt) ||
    !isTimestamp(completion.checkedAt) ||
    !isTimestamp(completion.deleteBy) ||
    completion.stage0AcceptancePassed !== true ||
    completion.stage1DistributionAuthorized !== false ||
    [
      "operationPackageSha256",
      "operationPackageLocationSha256",
      "startReceiptSha256",
      "hardwareEvidenceSha256",
      "hardwareEvidenceLocationSha256",
    ].some((key) => !sha256Pattern.test(completion[key] ?? ""))
  )
    throw new Error("Stage 0完了証跡がStage 1境界を満たしていません。");
  return completion;
};

const validateLedger = (ledger) => {
  exactKeys(ledger, ["format", "version", "entries"], "招待台帳");
  if (
    ledger.format !== "mangai.desktop-adult-pilot-invite-ledger" ||
    ledger.version !== 1 ||
    !Array.isArray(ledger.entries)
  )
    throw new Error("招待台帳の形式が不正です。");
  scanPrivateData(ledger, "招待台帳");
  const ids = new Set();
  for (const entry of ledger.entries) {
    exactKeys(
      entry,
      [
        "monitorId",
        "stage",
        "status",
        "desktopVersion",
        "environment",
        "distributedAt",
        "consentedAt",
        "stoppedAt",
      ],
      "招待台帳entry",
    );
    exactKeys(
      entry.environment,
      ["windows", "vramBand"],
      "招待台帳entry.environment",
    );
    if (
      !monitorIdPattern.test(entry.monitorId ?? "") ||
      ids.has(entry.monitorId) ||
      ![1, 2, 3].includes(entry.stage) ||
      !["INVITED", "ACTIVE", "STOPPED", "COMPLETED", "WITHDRAWN"].includes(
        entry.status,
      ) ||
      !versionPattern.test(entry.desktopVersion ?? "") ||
      entry.environment.windows !== "windows_11" ||
      !["12gb", "16gb_or_more"].includes(entry.environment.vramBand) ||
      !isTimestamp(entry.distributedAt) ||
      (entry.consentedAt !== null && !isTimestamp(entry.consentedAt)) ||
      (["ACTIVE", "COMPLETED"].includes(entry.status) &&
        !isTimestamp(entry.consentedAt)) ||
      (entry.stoppedAt !== null && !isTimestamp(entry.stoppedAt)) ||
      (entry.status === "STOPPED" && !isTimestamp(entry.stoppedAt))
    )
      throw new Error("招待台帳entryが不正です。");
    ids.add(entry.monitorId);
  }
  const liveStage1 = ledger.entries.filter(
    (entry) =>
      entry?.stage === 1 && ["INVITED", "ACTIVE"].includes(entry.status),
  );
  if (liveStage1.length)
    throw new Error("Stage 1には既に進行中の招待があります。");
  return ledger;
};

const defaultSourcePaths = (repositoryRoot) => ({
  rc: path.resolve(
    process.env.MANGAI_ADULT_PILOT_RC_STATUS_PATH ??
      path.join(repositoryRoot, "docs", "desktop", "RC_ACCEPTANCE_STATUS.json"),
  ),
  bundle: path.resolve(
    process.env.MANGAI_ADULT_PILOT_BUNDLE_PATH ??
      path.join(
        repositoryRoot,
        "docs",
        "desktop",
        "DESKTOP_ADULT_PILOT_BUNDLE.json",
      ),
  ),
  hardware: path.resolve(
    process.env.MANGAI_PHASE5_HARDWARE_STATUS_PATH ??
      path.join(
        repositoryRoot,
        "docs",
        "desktop",
        "PHASE5_HARDWARE_ACCEPTANCE.json",
      ),
  ),
  approvals: path.resolve(
    process.env.MANGAI_ADULT_PILOT_RELEASE_APPROVALS_PATH ??
      path.join(
        repositoryRoot,
        "docs",
        "desktop",
        "DESKTOP_ADULT_PILOT_RELEASE_APPROVALS.json",
      ),
  ),
});

const defaultReadinessVerifier = ({ repositoryRoot, sourcePaths }) => {
  const result = spawnSync(
    process.execPath,
    [
      path.join(
        repositoryRoot,
        "apps",
        "desktop",
        "scripts",
        "check-adult-pilot-release-readiness.mjs",
      ),
      "--strict",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        MANGAI_ADULT_PILOT_RC_STATUS_PATH: sourcePaths.rc,
        MANGAI_ADULT_PILOT_BUNDLE_PATH: sourcePaths.bundle,
        MANGAI_PHASE5_HARDWARE_STATUS_PATH: sourcePaths.hardware,
        MANGAI_ADULT_PILOT_RELEASE_APPROVALS_PATH: sourcePaths.approvals,
      },
    },
  );
  if (result.status !== 0)
    throw new Error("統合release readiness strictが成功していません。");
};

const normalizedOptions = (options) => {
  const repositoryRoot = options.repositoryRoot ?? defaultRepositoryRoot;
  return {
    ...options,
    repositoryRoot,
    sourcePaths: options.sourcePaths ?? defaultSourcePaths(repositoryRoot),
    releaseReadinessVerifier:
      options.releaseReadinessVerifier ?? defaultReadinessVerifier,
    now: options.now ?? new Date(),
    monitorId:
      options.monitorId ?? `monitor-${crypto.randomBytes(6).toString("hex")}`,
  };
};

const readSnapshot = (options) => {
  assertPrivatePath(
    options.repositoryRoot,
    options.assessmentPath,
    "候補assessment",
  );
  assertPrivatePath(
    options.repositoryRoot,
    options.packagePath,
    "Stage 0 operation package",
  );
  assertPrivatePath(
    options.repositoryRoot,
    options.completionPath,
    "Stage 0完了証跡",
  );
  assertPrivatePath(options.repositoryRoot, options.ledgerPath, "招待台帳");
  const paths = {
    assessment: options.assessmentPath,
    operationPackage: options.packagePath,
    completion: options.completionPath,
    ledger: options.ledgerPath,
    rc: options.sourcePaths.rc,
    bundle: options.sourcePaths.bundle,
    hardware: options.sourcePaths.hardware,
    approvals: options.sourcePaths.approvals,
  };
  const bytes = Object.fromEntries(
    Object.entries(paths).map(([key, target]) => [key, readFile(target, key)]),
  );
  return { paths, bytes };
};

const assertStable = (before, after) => {
  for (const key of Object.keys(before.bytes))
    if (!before.bytes[key].equals(after.bytes[key]))
      throw new Error(`Stage 1 source ${key}が検証中に変更されました。`);
};

const verifyCurrentSources = (options) => {
  const before = readSnapshot(options);
  options.releaseReadinessVerifier({
    repositoryRoot: options.repositoryRoot,
    sourcePaths: options.sourcePaths,
  });
  const after = readSnapshot(options);
  assertStable(before, after);
  const assessment = validateAssessment(
    readJson(after.bytes.assessment, "候補assessment"),
  );
  const completion = validateCompletion(
    readJson(after.bytes.completion, "Stage 0完了証跡"),
  );
  const ledger = validateLedger(readJson(after.bytes.ledger, "招待台帳"));
  const hardware = readJson(after.bytes.hardware, "12GB受入れ表");
  const profile = hardware.profiles?.find(
    (item) => item.profile === "vram_12gb",
  );
  const expectedCompletionPath = `${path.resolve(options.packagePath)}.stage0-completion.json`;
  const actualCompletionPath = path.resolve(options.completionPath);
  const sameCompletionPath =
    process.platform === "win32"
      ? expectedCompletionPath.toLowerCase() ===
        actualCompletionPath.toLowerCase()
      : expectedCompletionPath === actualCompletionPath;
  if (
    !sameCompletionPath ||
    completion.operationPackageSha256 !==
      digest(after.bytes.operationPackage) ||
    completion.operationPackageLocationSha256 !==
      locationDigest(options.packagePath) ||
    assessment.candidateId !== completion.candidateId ||
    profile?.status !== "passed" ||
    profile.stage0Completion?.status !== "passed" ||
    profile.stage0Completion.completionSha256 !==
      digest(after.bytes.completion) ||
    profile.stage0Completion.operationPackageSha256 !==
      completion.operationPackageSha256 ||
    profile.stage0Completion.startReceiptSha256 !==
      completion.startReceiptSha256 ||
    profile.stage0Completion.hardwareEvidenceSha256 !==
      completion.hardwareEvidenceSha256 ||
    profile.stage0Completion.stage1DistributionAuthorized !== false
  )
    throw new Error("候補者、Stage 0完了証跡、12GB受入れ表が一致しません。");
  return {
    assessment,
    completion,
    ledger,
    sources: Object.fromEntries(
      Object.entries(after.bytes).map(([key, value]) => [
        key,
        `${digest(value)}:${locationDigest(after.paths[key])}`,
      ]),
    ),
  };
};

const assertTimeBoundary = (options, completion) => {
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("Stage 1承認日時が不正です。");
  if (!isTimestamp(options.expiresAt))
    throw new Error("Stage 1承認期限が不正です。");
  const now = options.now.getTime();
  const expires = Date.parse(options.expiresAt);
  if (
    now >= Date.parse(completion.deleteBy) ||
    expires >= Date.parse(completion.deleteBy)
  )
    throw new Error("Stage 0証跡の削除期限内でのみStage 1を承認できます。");
  if (expires <= now || expires - now > 24 * 60 * 60 * 1000)
    throw new Error("Stage 1承認期限は24時間以内で指定してください。");
};

export const createStage1InvitationAuthorization = (rawOptions) => {
  const options = normalizedOptions(rawOptions);
  assertPrivatePath(
    options.repositoryRoot,
    options.outputPath,
    "Stage 1招待承認",
  );
  if (
    !fs
      .statSync(path.dirname(options.outputPath), { throwIfNoEntry: false })
      ?.isDirectory()
  )
    throw new Error("Stage 1招待承認の出力先directoryがありません。");
  if (
    options.confirmOwnerApproved !== true ||
    options.confirmSignedPilotArtifact !== true ||
    options.confirmAssistedFirstPanel !== true ||
    options.confirmObservation24Hours !== true ||
    options.confirmManualStop !== true
  )
    throw new Error("Stage 1招待に必要な明示確認が完了していません。");
  if (!versionPattern.test(options.pilotVersion ?? ""))
    throw new Error("Stage 1 Pilot versionが不正です。");
  if (!monitorIdPattern.test(options.monitorId))
    throw new Error("monitor IDが不正です。");
  const verified = verifyCurrentSources(options);
  assertTimeBoundary(options, verified.completion);
  const authorization = {
    format: "mangai.desktop-adult-stage1-invitation-authorization",
    version: 1,
    approvedAt: options.now.toISOString(),
    expiresAt: options.expiresAt,
    authorizationLocationSha256: locationDigest(options.outputPath),
    candidateId: verified.assessment.candidateId,
    monitorId: options.monitorId,
    pilotVersion: options.pilotVersion,
    stage: 1,
    sources: verified.sources,
    ownerApproved: true,
    signedPilotArtifactConfirmed: true,
    assistedFirstPanelConfirmed: true,
    observation24HoursConfirmed: true,
    manualStopConstraintAccepted: true,
    stage1DistributionAuthorized: true,
  };
  fs.writeFileSync(
    options.outputPath,
    `${JSON.stringify(authorization, null, 2)}\n`,
    {
      flag: "wx",
      mode: 0o600,
    },
  );
  return authorization;
};

const validateAuthorization = (authorization, options, verified) => {
  exactKeys(
    authorization,
    [
      "format",
      "version",
      "approvedAt",
      "expiresAt",
      "authorizationLocationSha256",
      "candidateId",
      "monitorId",
      "pilotVersion",
      "stage",
      "sources",
      "ownerApproved",
      "signedPilotArtifactConfirmed",
      "assistedFirstPanelConfirmed",
      "observation24HoursConfirmed",
      "manualStopConstraintAccepted",
      "stage1DistributionAuthorized",
    ],
    "Stage 1招待承認",
  );
  if (
    authorization.format !==
      "mangai.desktop-adult-stage1-invitation-authorization" ||
    authorization.version !== 1 ||
    !isTimestamp(authorization.approvedAt) ||
    !isTimestamp(authorization.expiresAt) ||
    authorization.authorizationLocationSha256 !==
      locationDigest(options.authorizationPath) ||
    authorization.candidateId !== verified.assessment.candidateId ||
    !monitorIdPattern.test(authorization.monitorId ?? "") ||
    !versionPattern.test(authorization.pilotVersion ?? "") ||
    authorization.stage !== 1 ||
    JSON.stringify(authorization.sources) !==
      JSON.stringify(verified.sources) ||
    authorization.ownerApproved !== true ||
    authorization.signedPilotArtifactConfirmed !== true ||
    authorization.assistedFirstPanelConfirmed !== true ||
    authorization.observation24HoursConfirmed !== true ||
    authorization.manualStopConstraintAccepted !== true ||
    authorization.stage1DistributionAuthorized !== true
  )
    throw new Error("Stage 1招待承認が現在の安全境界と一致しません。");
  const now = options.now.getTime();
  if (
    now < Date.parse(authorization.approvedAt) ||
    now >= Date.parse(authorization.expiresAt)
  )
    throw new Error("Stage 1招待承認の有効期間外です。");
};

export const consumeStage1InvitationAuthorization = (rawOptions) => {
  const options = normalizedOptions(rawOptions);
  assertPrivatePath(
    options.repositoryRoot,
    options.authorizationPath,
    "Stage 1招待承認",
  );
  const receiptPath = `${options.authorizationPath}.consumed.json`;
  assertPrivatePath(
    options.repositoryRoot,
    receiptPath,
    "Stage 1招待承認receipt",
  );
  const before = readFile(options.authorizationPath, "Stage 1招待承認");
  const verified = verifyCurrentSources(options);
  const authorizationBytes = readFile(
    options.authorizationPath,
    "Stage 1招待承認",
  );
  if (!before.equals(authorizationBytes))
    throw new Error("Stage 1招待承認が検証中に変更されました。");
  const authorization = readJson(authorizationBytes, "Stage 1招待承認");
  validateAuthorization(authorization, options, verified);
  const receipt = {
    format: "mangai.desktop-adult-stage1-invitation-receipt",
    version: 1,
    consumedAt: options.now.toISOString(),
    authorizationSha256: digest(authorizationBytes),
    candidateId: authorization.candidateId,
    monitorId: authorization.monitorId,
    pilotVersion: authorization.pilotVersion,
    stage: 1,
    stage1DistributionAuthorized: true,
    nextStep: "manual_distribution_then_invite_ledger_record",
  };
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  return { receipt, receiptPath };
};

const valueFlags = new Set([
  "--assessment",
  "--stage0-package",
  "--stage0-completion",
  "--ledger",
  "--pilot-version",
  "--expires-at",
  "--out",
  "--authorization",
]);
const booleanFlags = new Set([
  "--confirm-owner-approved",
  "--confirm-signed-pilot-artifact",
  "--confirm-assisted-first-panel",
  "--confirm-observation-24-hours",
  "--confirm-manual-stop",
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
    for (const flag of [
      "--assessment",
      "--stage0-package",
      "--stage0-completion",
      "--ledger",
    ])
      if (!args.has(flag))
        throw new Error("Stage 1 source引数が不足しています。");
    const common = {
      assessmentPath: args.get("--assessment"),
      packagePath: args.get("--stage0-package"),
      completionPath: args.get("--stage0-completion"),
      ledgerPath: args.get("--ledger"),
      now: new Date(),
    };
    let result;
    if (mode === "create") {
      for (const flag of ["--pilot-version", "--expires-at", "--out"])
        if (!args.has(flag)) throw new Error("create引数が不足しています。");
      if (args.has("--authorization"))
        throw new Error("createに対応しない引数があります。");
      result = createStage1InvitationAuthorization({
        ...common,
        pilotVersion: args.get("--pilot-version"),
        expiresAt: args.get("--expires-at"),
        outputPath: args.get("--out"),
        confirmOwnerApproved: args.has("--confirm-owner-approved"),
        confirmSignedPilotArtifact: args.has("--confirm-signed-pilot-artifact"),
        confirmAssistedFirstPanel: args.has("--confirm-assisted-first-panel"),
        confirmObservation24Hours: args.has("--confirm-observation-24-hours"),
        confirmManualStop: args.has("--confirm-manual-stop"),
      });
    } else {
      if (
        !args.has("--authorization") ||
        args.has("--pilot-version") ||
        args.has("--expires-at") ||
        args.has("--out") ||
        [...booleanFlags].some((flag) => args.has(flag))
      )
        throw new Error("consumeに対応する承認引数を指定してください。");
      result = consumeStage1InvitationAuthorization({
        ...common,
        authorizationPath: args.get("--authorization"),
      }).receipt;
    }
    console.log("MANGAI Desktop Adult Stage 1 invitation authorization");
    console.log(`  Mode: ${mode}`);
    console.log(`  Pilot version: ${result.pilotVersion}`);
    console.log("  Candidate, monitor ID, and paths: hidden");
    console.log("  Release readiness strict: verified");
    console.log("  Automatic distribution or invitation: no");
    console.log(`  Result: ${mode === "create" ? "CREATED" : "CONSUMED"}`);
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "Stage 1招待承認のfile操作に失敗しました。"
        : error.message;
    console.error(`Stage 1 invitation authorization failed: ${message}`);
    process.exit(1);
  }
}
