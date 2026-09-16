import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const sha256Pattern = /^[a-f0-9]{64}$/;
const sourceBindingPattern = /^[a-f0-9]{64}:[a-f0-9]{64}$/;
const candidateIdPattern = /^candidate-[a-f0-9]{12}$/;
const monitorIdPattern = /^monitor-[a-f0-9]{12}$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-beta\.\d+)?$/;
const forbiddenKeys =
  /^(name|email|address|phone|prompt|negativePrompt|image|mask|projectName|deviceName|hostname|serialNumber|ipAddress|macAddress|absolutePath|content|notes?)$/i;
const emailPattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const absolutePathPattern =
  /(?:[a-z]:\\|\\\\[^\\]+\\|file:\/\/|\/(?:home|users|var|tmp)\/)/i;

export const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");

export const locationDigest = (target) => {
  const resolved = path.resolve(target);
  const canonical =
    process.platform === "win32" ? resolved.toLowerCase() : resolved;
  return digest(Buffer.from(canonical, "utf8"));
};

export const sourceBinding = (bytes, target) =>
  `${digest(bytes)}:${locationDigest(target)}`;

const isInside = (parent, child) => {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

export const assertPrivatePath = (repositoryRoot, target, label) => {
  if (!path.isAbsolute(target ?? "") || target.startsWith("\\\\"))
    throw new Error(
      `${label}はローカルドライブ上の絶対pathで指定してください。`,
    );
  if (isInside(repositoryRoot, target))
    throw new Error(`${label}はGit管理外のアクセス制限領域に置いてください。`);
};

export const readFile = (target, label) => {
  try {
    const bytes = fs.readFileSync(target);
    if (!bytes.length) throw new Error();
    return bytes;
  } catch {
    throw new Error(`${label}を読み取れませんでした。`);
  }
};

export const readJson = (bytes, label) => {
  try {
    const value = JSON.parse(bytes.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new Error(`${label}のJSONが不正です。`);
  }
};

export const exactKeys = (value, expected, label) => {
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

export const isTimestamp = (value) =>
  typeof value === "string" &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

export const scanPrivateData = (value, location) => {
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

export const validateAssessment = (assessment) => {
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

export const validateAuthorization = (authorization, authorizationPath) => {
  scanPrivateData(authorization, "Stage 1招待承認");
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
  exactKeys(
    authorization.sources,
    [
      "assessment",
      "operationPackage",
      "completion",
      "ledger",
      "rc",
      "bundle",
      "hardware",
      "approvals",
    ],
    "Stage 1招待承認.sources",
  );
  if (
    authorization.format !==
      "mangai.desktop-adult-stage1-invitation-authorization" ||
    authorization.version !== 1 ||
    !isTimestamp(authorization.approvedAt) ||
    !isTimestamp(authorization.expiresAt) ||
    authorization.authorizationLocationSha256 !==
      locationDigest(authorizationPath) ||
    !candidateIdPattern.test(authorization.candidateId ?? "") ||
    !monitorIdPattern.test(authorization.monitorId ?? "") ||
    !versionPattern.test(authorization.pilotVersion ?? "") ||
    authorization.stage !== 1 ||
    Object.values(authorization.sources).some(
      (value) => !sourceBindingPattern.test(value ?? ""),
    ) ||
    authorization.ownerApproved !== true ||
    authorization.signedPilotArtifactConfirmed !== true ||
    authorization.assistedFirstPanelConfirmed !== true ||
    authorization.observation24HoursConfirmed !== true ||
    authorization.manualStopConstraintAccepted !== true ||
    authorization.stage1DistributionAuthorized !== true ||
    Date.parse(authorization.approvedAt) >= Date.parse(authorization.expiresAt)
  )
    throw new Error("Stage 1招待承認が配布記録の安全境界を満たしません。");
  return authorization;
};

export const validateReceipt = (receipt, authorization, authorizationBytes) => {
  scanPrivateData(receipt, "Stage 1招待承認receipt");
  exactKeys(
    receipt,
    [
      "format",
      "version",
      "consumedAt",
      "authorizationSha256",
      "candidateId",
      "monitorId",
      "pilotVersion",
      "stage",
      "stage1DistributionAuthorized",
      "nextStep",
    ],
    "Stage 1招待承認receipt",
  );
  if (
    receipt.format !== "mangai.desktop-adult-stage1-invitation-receipt" ||
    receipt.version !== 1 ||
    !isTimestamp(receipt.consumedAt) ||
    !sha256Pattern.test(receipt.authorizationSha256 ?? "") ||
    receipt.authorizationSha256 !== digest(authorizationBytes) ||
    receipt.candidateId !== authorization.candidateId ||
    receipt.monitorId !== authorization.monitorId ||
    receipt.pilotVersion !== authorization.pilotVersion ||
    receipt.stage !== 1 ||
    receipt.stage1DistributionAuthorized !== true ||
    receipt.nextStep !== "manual_distribution_then_invite_ledger_record" ||
    Date.parse(receipt.consumedAt) < Date.parse(authorization.approvedAt) ||
    Date.parse(receipt.consumedAt) >= Date.parse(authorization.expiresAt)
  )
    throw new Error("Stage 1招待承認receiptが承認内容と一致しません。");
  return receipt;
};

export const validateLedger = (ledger) => {
  scanPrivateData(ledger, "招待台帳");
  exactKeys(ledger, ["format", "version", "entries"], "招待台帳");
  if (
    ledger.format !== "mangai.desktop-adult-pilot-invite-ledger" ||
    ledger.version !== 1 ||
    !Array.isArray(ledger.entries)
  )
    throw new Error("招待台帳の形式が不正です。");
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
  return ledger;
};

export const assertTimeBoundary = (options, authorization, receipt) => {
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("招待台帳proposal作成日時が不正です。");
  if (!isTimestamp(options.distributedAt))
    throw new Error("実配布日時が不正です。");
  const now = options.now.getTime();
  const distributedAt = Date.parse(options.distributedAt);
  if (
    now < Date.parse(authorization.approvedAt) ||
    now >= Date.parse(authorization.expiresAt) ||
    distributedAt < Date.parse(receipt.consumedAt) ||
    distributedAt > now ||
    distributedAt >= Date.parse(authorization.expiresAt)
  )
    throw new Error("実配布日時が一回限定承認の有効期間と一致しません。");
};

export const createStage1InviteLedgerProposal = (rawOptions) => {
  const options = {
    ...rawOptions,
    repositoryRoot: rawOptions.repositoryRoot ?? defaultRepositoryRoot,
    now: rawOptions.now ?? new Date(),
  };
  for (const [target, label] of [
    [options.authorizationPath, "Stage 1招待承認"],
    [options.assessmentPath, "候補assessment"],
    [options.ledgerPath, "招待台帳"],
  ])
    assertPrivatePath(options.repositoryRoot, target, label);
  const receiptPath = `${options.authorizationPath}.consumed.json`;
  const proposalPath = `${options.authorizationPath}.ledger-proposal.json`;
  assertPrivatePath(
    options.repositoryRoot,
    receiptPath,
    "Stage 1招待承認receipt",
  );
  assertPrivatePath(options.repositoryRoot, proposalPath, "招待台帳proposal");
  if (
    options.confirmManualDistributionCompleted !== true ||
    options.confirmRecipientMatched !== true ||
    options.confirmStopContactShared !== true ||
    options.confirmContentRemainedLocal !== true
  )
    throw new Error("招待台帳proposalに必要な明示確認が完了していません。");

  const authorizationBytes = readFile(
    options.authorizationPath,
    "Stage 1招待承認",
  );
  const receiptBytes = readFile(receiptPath, "Stage 1招待承認receipt");
  const assessmentBytes = readFile(options.assessmentPath, "候補assessment");
  const ledgerBytes = readFile(options.ledgerPath, "招待台帳");
  const authorization = validateAuthorization(
    readJson(authorizationBytes, "Stage 1招待承認"),
    options.authorizationPath,
  );
  const receipt = validateReceipt(
    readJson(receiptBytes, "Stage 1招待承認receipt"),
    authorization,
    authorizationBytes,
  );
  const assessment = validateAssessment(
    readJson(assessmentBytes, "候補assessment"),
  );
  const ledger = validateLedger(readJson(ledgerBytes, "招待台帳"));
  if (
    assessment.candidateId !== authorization.candidateId ||
    authorization.sources.assessment !==
      sourceBinding(assessmentBytes, options.assessmentPath) ||
    authorization.sources.ledger !==
      sourceBinding(ledgerBytes, options.ledgerPath)
  )
    throw new Error("候補assessmentまたは招待台帳が承認時点と一致しません。");
  if (
    ledger.entries.some((entry) => entry.monitorId === authorization.monitorId)
  )
    throw new Error("同じmonitor IDが招待台帳に既に存在します。");
  if (
    ledger.entries.some(
      (entry) =>
        entry.stage === 1 && ["INVITED", "ACTIVE"].includes(entry.status),
    )
  )
    throw new Error("Stage 1には既に進行中の招待があります。");
  assertTimeBoundary(options, authorization, receipt);

  const proposal = {
    format: "mangai.desktop-adult-pilot-invite-ledger",
    version: 1,
    entries: [
      ...ledger.entries,
      {
        monitorId: authorization.monitorId,
        stage: 1,
        status: "INVITED",
        desktopVersion: authorization.pilotVersion,
        environment: {
          windows: "windows_11",
          vramBand: assessment.environment.vramBand,
        },
        distributedAt: options.distributedAt,
        consentedAt: null,
        stoppedAt: null,
      },
    ],
  };
  validateLedger(proposal);
  for (const [target, label, original] of [
    [options.authorizationPath, "Stage 1招待承認", authorizationBytes],
    [receiptPath, "Stage 1招待承認receipt", receiptBytes],
    [options.assessmentPath, "候補assessment", assessmentBytes],
    [options.ledgerPath, "招待台帳", ledgerBytes],
  ])
    if (!readFile(target, label).equals(original))
      throw new Error(`${label}がproposal作成中に変更されました。`);
  fs.writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  return { proposal, proposalPath };
};

const valueFlags = new Set([
  "--authorization",
  "--assessment",
  "--ledger",
  "--distributed-at",
]);
const booleanFlags = new Set([
  "--confirm-manual-distribution-completed",
  "--confirm-recipient-matched",
  "--confirm-stop-contact-shared",
  "--confirm-content-remained-local",
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
    const args = parseArgs(process.argv.slice(2));
    for (const flag of valueFlags)
      if (!args.has(flag))
        throw new Error("招待台帳proposalの引数が不足しています。");
    const result = createStage1InviteLedgerProposal({
      authorizationPath: args.get("--authorization"),
      assessmentPath: args.get("--assessment"),
      ledgerPath: args.get("--ledger"),
      distributedAt: args.get("--distributed-at"),
      confirmManualDistributionCompleted: args.has(
        "--confirm-manual-distribution-completed",
      ),
      confirmRecipientMatched: args.has("--confirm-recipient-matched"),
      confirmStopContactShared: args.has("--confirm-stop-contact-shared"),
      confirmContentRemainedLocal: args.has("--confirm-content-remained-local"),
    });
    console.log("MANGAI Desktop Adult Stage 1 invite ledger proposal");
    console.log(`  Entries: ${result.proposal.entries.length}`);
    console.log("  Candidate, monitor ID, and paths: hidden");
    console.log("  Existing ledger replaced: no");
    console.log("  Automatic distribution or invitation: no");
    console.log("  Result: PROPOSAL_CREATED");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "招待台帳proposalのfile操作に失敗しました。"
        : error.message;
    console.error(`Stage 1 invite ledger proposal failed: ${message}`);
    process.exit(1);
  }
}
