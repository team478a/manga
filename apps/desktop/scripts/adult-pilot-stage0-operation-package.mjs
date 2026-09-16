import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const defaultDesktopRoot = path.join(defaultRepositoryRoot, "apps", "desktop");
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

const exactKeys = (value, expected, label) => {
  const keys = Object.keys(value).sort();
  const required = [...expected].sort();
  if (
    keys.length !== required.length ||
    keys.some((key, index) => key !== required[index])
  )
    throw new Error(`${label}のfield構成が不正です。`);
};

export const runStage0Readiness = ({
  desktopRoot = defaultDesktopRoot,
  assessmentPath,
  planPath,
  artifactEvidencePath,
  bundleEvidencePath,
  bundlePath = path.join(
    desktopRoot,
    "../../docs/desktop/DESKTOP_ADULT_PILOT_BUNDLE.json",
  ),
  approvalsPath = path.join(
    desktopRoot,
    "../../docs/desktop/DESKTOP_ADULT_PILOT_RELEASE_APPROVALS.json",
  ),
  desktopPackagePath = path.join(desktopRoot, "package.json"),
}) => {
  const result = spawnSync(
    process.execPath,
    [
      path.join(desktopRoot, "scripts/check-adult-pilot-stage0-readiness.mjs"),
      "--strict",
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      env: {
        ...process.env,
        MANGAI_ADULT_PILOT_STAGE0_ASSESSMENT_PATH: assessmentPath,
        MANGAI_ADULT_PILOT_STAGE0_PLAN_PATH: planPath,
        MANGAI_ADULT_PILOT_STAGE0_ARTIFACT_EVIDENCE_PATH: artifactEvidencePath,
        MANGAI_ADULT_PILOT_STAGE0_BUNDLE_EVIDENCE_PATH: bundleEvidencePath,
        MANGAI_ADULT_PILOT_BUNDLE_PATH: bundlePath,
        MANGAI_ADULT_PILOT_RELEASE_APPROVALS_PATH: approvalsPath,
        MANGAI_ADULT_PILOT_DESKTOP_PACKAGE_PATH: desktopPackagePath,
      },
    },
  );
  if (result.status !== 0)
    throw new Error("Stage 0 readiness strictが成功していません。");
};

const loadSources = (options) => {
  const sourcePaths = {
    assessment: options.assessmentPath,
    plan: options.planPath,
    artifactEvidence: options.artifactEvidencePath,
    bundleEvidence: options.bundleEvidencePath,
    bundle: options.bundlePath,
    approvals: options.approvalsPath,
  };
  for (const [id, target] of Object.entries(sourcePaths)) {
    if (id !== "bundle" && id !== "approvals")
      assertPrivatePath(options.repositoryRoot, target, id);
  }
  const sourceBytes = Object.fromEntries(
    Object.entries(sourcePaths).map(([id, target]) => [
      id,
      readFile(target, id),
    ]),
  );
  const sourceJson = Object.fromEntries(
    Object.entries(sourceBytes).map(([id, bytes]) => [id, readJson(bytes, id)]),
  );
  const {
    assessment,
    plan,
    artifactEvidence,
    bundleEvidence,
    bundle,
    approvals,
  } = sourceJson;
  if (
    assessment.format !== "mangai.desktop-adult-technical-monitor-assessment" ||
    plan.format !== "mangai.desktop-adult-stage0-plan" ||
    artifactEvidence.format !==
      "mangai.desktop-adult-stage0-artifact-evidence" ||
    bundleEvidence.format !== "mangai.desktop-adult-pilot-bundle-evidence" ||
    bundle.format !== "mangai.desktop-adult-pilot-bundle" ||
    approvals.format !== "mangai.desktop-adult-pilot-release-approvals"
  )
    throw new Error("Stage 0 sourceのformatが不正です。");
  if (
    !candidateIdPattern.test(assessment.candidateId ?? "") ||
    assessment.candidateId !== plan.candidateId
  )
    throw new Error("candidate IDが一致しません。");
  if (
    typeof plan.artifactVersion !== "string" ||
    plan.artifactVersion.length === 0 ||
    plan.artifactVersion !== artifactEvidence.artifactVersion ||
    plan.artifactPurpose !== "stage0_acceptance_only" ||
    plan.artifactPurpose !== artifactEvidence.artifactPurpose ||
    plan.stage1DistributionAuthorized !== false ||
    artifactEvidence.distributionAuthorized !== false ||
    assessment.distributionAuthorized !== false
  )
    throw new Error("Stage 0 artifactまたは配布境界が一致しません。");
  return { sourceBytes, sourceJson };
};

const sourceDigests = (bytes) => ({
  candidateAssessmentSha256: digest(bytes.assessment),
  stage0PlanSha256: digest(bytes.plan),
  artifactEvidenceSha256: digest(bytes.artifactEvidence),
  bundleEvidenceSha256: digest(bytes.bundleEvidence),
  fixedBundleManifestSha256: digest(bytes.bundle),
  ownerApprovalsSha256: digest(bytes.approvals),
});

const normalizedOptions = (options) => {
  const desktopRoot = options.desktopRoot ?? defaultDesktopRoot;
  return {
    ...options,
    repositoryRoot: options.repositoryRoot ?? defaultRepositoryRoot,
    desktopRoot,
    bundlePath:
      options.bundlePath ??
      path.resolve(
        desktopRoot,
        "../../docs/desktop/DESKTOP_ADULT_PILOT_BUNDLE.json",
      ),
    approvalsPath:
      options.approvalsPath ??
      path.resolve(
        desktopRoot,
        "../../docs/desktop/DESKTOP_ADULT_PILOT_RELEASE_APPROVALS.json",
      ),
    desktopPackagePath:
      options.desktopPackagePath ?? path.join(desktopRoot, "package.json"),
    readinessCheck: options.readinessCheck ?? runStage0Readiness,
    now: options.now ?? new Date(),
  };
};

const verifyCurrentReadiness = (options) =>
  options.readinessCheck({
    desktopRoot: options.desktopRoot,
    assessmentPath: options.assessmentPath,
    planPath: options.planPath,
    artifactEvidencePath: options.artifactEvidencePath,
    bundleEvidencePath: options.bundleEvidencePath,
    bundlePath: options.bundlePath,
    approvalsPath: options.approvalsPath,
    desktopPackagePath: options.desktopPackagePath,
  });

export const createStage0OperationPackage = (rawOptions) => {
  const options = normalizedOptions(rawOptions);
  assertPrivatePath(
    options.repositoryRoot,
    options.outputPath,
    "operation package",
  );
  const parent = path.dirname(options.outputPath);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory())
    throw new Error("operation packageの出力先directoryがありません。");
  if (!(options.now instanceof Date) || Number.isNaN(options.now.getTime()))
    throw new Error("operation package作成日時が不正です。");
  verifyCurrentReadiness(options);
  const { sourceBytes, sourceJson } = loadSources(options);
  const operationPackage = {
    format: "mangai.desktop-adult-stage0-operation-package",
    version: 1,
    createdAt: options.now.toISOString(),
    candidateId: sourceJson.assessment.candidateId,
    artifactVersion: sourceJson.plan.artifactVersion,
    artifactPurpose: "stage0_acceptance_only",
    scheduledStartAt: sourceJson.plan.scheduledStartAt,
    deleteBy: sourceJson.plan.deleteBy,
    sources: sourceDigests(sourceBytes),
    stage0Ready: true,
    stage1DistributionAuthorized: false,
  };
  fs.writeFileSync(
    options.outputPath,
    `${JSON.stringify(operationPackage, null, 2)}\n`,
    { flag: "wx", mode: 0o600 },
  );
  return operationPackage;
};

export const verifyStage0OperationPackage = (rawOptions) => {
  const options = normalizedOptions(rawOptions);
  assertPrivatePath(
    options.repositoryRoot,
    options.packagePath,
    "operation package",
  );
  verifyCurrentReadiness(options);
  const { sourceBytes, sourceJson } = loadSources(options);
  const operationPackage = readJson(
    readFile(options.packagePath, "operation package"),
    "operation package",
  );
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
  exactKeys(
    operationPackage.sources,
    [
      "candidateAssessmentSha256",
      "stage0PlanSha256",
      "artifactEvidenceSha256",
      "bundleEvidenceSha256",
      "fixedBundleManifestSha256",
      "ownerApprovalsSha256",
    ],
    "operation package sources",
  );
  const expectedDigests = sourceDigests(sourceBytes);
  if (
    operationPackage.format !==
      "mangai.desktop-adult-stage0-operation-package" ||
    operationPackage.version !== 1 ||
    operationPackage.candidateId !== sourceJson.assessment.candidateId ||
    operationPackage.artifactVersion !== sourceJson.plan.artifactVersion ||
    operationPackage.artifactPurpose !== "stage0_acceptance_only" ||
    operationPackage.scheduledStartAt !== sourceJson.plan.scheduledStartAt ||
    operationPackage.deleteBy !== sourceJson.plan.deleteBy ||
    operationPackage.stage0Ready !== true ||
    operationPackage.stage1DistributionAuthorized !== false ||
    Number.isNaN(Date.parse(operationPackage.createdAt ?? "")) ||
    new Date(operationPackage.createdAt).toISOString() !==
      operationPackage.createdAt ||
    Object.entries(expectedDigests).some(
      ([key, value]) =>
        !sha256Pattern.test(operationPackage.sources[key] ?? "") ||
        operationPackage.sources[key] !== value,
    )
  )
    throw new Error("operation packageと現在のStage 0 sourceが一致しません。");
  return operationPackage;
};

const valueFlags = new Set([
  "--assessment",
  "--plan",
  "--artifact-evidence",
  "--bundle-evidence",
  "--out",
  "--package",
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
    const mode = process.argv[2];
    if (!new Set(["create", "verify"]).has(mode))
      throw new Error("createまたはverifyを指定してください。");
    const args = parseArgs(process.argv.slice(3));
    if (
      (mode === "create" && (!args.has("--out") || args.has("--package"))) ||
      (mode === "verify" && (!args.has("--package") || args.has("--out")))
    )
      throw new Error("modeに対応する出力引数を指定してください。");
    const common = {
      assessmentPath: args.get("--assessment"),
      planPath: args.get("--plan"),
      artifactEvidencePath: args.get("--artifact-evidence"),
      bundleEvidencePath: args.get("--bundle-evidence"),
    };
    const operationPackage =
      mode === "create"
        ? createStage0OperationPackage({
            ...common,
            outputPath: args.get("--out"),
            now: new Date(),
          })
        : verifyStage0OperationPackage({
            ...common,
            packagePath: args.get("--package"),
          });
    console.log("MANGAI Desktop Adult Stage 0 operation package");
    console.log(`  Mode: ${mode}`);
    console.log(`  Artifact version: ${operationPackage.artifactVersion}`);
    console.log("  Candidate identity and paths: hidden");
    console.log("  Source digests: verified");
    console.log("  Stage 0 ready: yes");
    console.log("  Stage 1 distribution authorized: no");
    console.log(`  Result: ${mode === "create" ? "CREATED" : "VERIFIED"}`);
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "operation packageのfile操作に失敗しました。"
        : error.message;
    console.error(`Stage 0 operation package failed: ${message}`);
    process.exit(1);
  }
}
