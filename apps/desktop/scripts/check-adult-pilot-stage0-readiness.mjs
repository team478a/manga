import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const fromEnv = (name, fallback) =>
  path.resolve(process.env[name] ?? path.join(root, fallback));
const paths = {
  assessment: process.env.MANGAI_ADULT_PILOT_STAGE0_ASSESSMENT_PATH
    ? path.resolve(process.env.MANGAI_ADULT_PILOT_STAGE0_ASSESSMENT_PATH)
    : undefined,
  artifactEvidence: process.env.MANGAI_ADULT_PILOT_STAGE0_ARTIFACT_EVIDENCE_PATH
    ? path.resolve(process.env.MANGAI_ADULT_PILOT_STAGE0_ARTIFACT_EVIDENCE_PATH)
    : undefined,
  bundleEvidence: process.env.MANGAI_ADULT_PILOT_STAGE0_BUNDLE_EVIDENCE_PATH
    ? path.resolve(process.env.MANGAI_ADULT_PILOT_STAGE0_BUNDLE_EVIDENCE_PATH)
    : undefined,
  plan: fromEnv(
    "MANGAI_ADULT_PILOT_STAGE0_PLAN_PATH",
    "docs/desktop/DESKTOP_ADULT_STAGE0_PLAN.example.json",
  ),
  bundle: fromEnv(
    "MANGAI_ADULT_PILOT_BUNDLE_PATH",
    "docs/desktop/DESKTOP_ADULT_PILOT_BUNDLE.json",
  ),
  approvals: fromEnv(
    "MANGAI_ADULT_PILOT_RELEASE_APPROVALS_PATH",
    "docs/desktop/DESKTOP_ADULT_PILOT_RELEASE_APPROVALS.json",
  ),
  desktopPackage: fromEnv(
    "MANGAI_ADULT_PILOT_DESKTOP_PACKAGE_PATH",
    "apps/desktop/package.json",
  ),
};
const strict = process.argv.includes("--strict");
const candidateIdPattern = /^candidate-[0-9a-f]{12}$/;
const forbiddenKeys =
  /^(name|email|address|phone|prompt|negativePrompt|image|mask|projectName|deviceName|hostname|serialNumber|ipAddress|macAddress|absolutePath|content|notes?)$/i;
const emailPattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const absolutePathPattern =
  /(?:[a-z]:\\|\\\\[^\\]+\\|file:\/\/|\/(?:home|users|var|tmp)\/)/i;
const exactPlanKeys = [
  "format",
  "version",
  "candidateId",
  "artifactVersion",
  "artifactPurpose",
  "scheduledStartAt",
  "deleteBy",
  "assistedSessionConfirmed",
  "stopContactConfirmed",
  "evidenceTransferConfirmed",
  "artifactSeparatedFromStage1",
  "stage1DistributionAuthorized",
];
const exactAssessmentKeys = [
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
];
const exactEnvironmentKeys = [
  "windows",
  "gpuVendor",
  "vramBand",
  "ramBand",
  "freeDiskBand",
];
const exactArtifactEvidenceKeys = [
  "format",
  "version",
  "generatedAt",
  "artifactVersion",
  "artifactPurpose",
  "distributionAuthorized",
  "signatures",
  "artifacts",
];
const exactSignatureKeys = [
  "installerStatus",
  "productExecutableStatus",
  "sameSigner",
];
const exactArtifactDigestKeys = [
  "installerSha256",
  "blockmapSha256",
  "updateMetadataSha256",
  "sbomSha256",
  "checksumsSha256",
  "productExecutableSha256",
];
const exactBundleEvidenceKeys = [
  "format",
  "version",
  "checkedAt",
  "manifestSha256",
  "artifacts",
];
const exactBundleEvidenceArtifactKeys = ["id", "bytes", "sha256"];
const exactBundleVerificationKeys = [
  "format",
  "version",
  "evidenceCheckedAt",
  "sourceManifestSha256",
  "evidenceSha256",
  "artifacts",
  "workflows",
];
const exactBundleWorkflowKeys = ["operation", "sha256", "mappingSha256"];
const requiredBundleArtifactIds = [
  "runtime",
  "checkpoint",
  "vae",
  "controlnet",
];
const requiredBundleOperations = [
  "text_to_image",
  "image_to_image",
  "controlnet",
  "inpainting",
];
const sha256Pattern = /^[a-f0-9]{64}$/;

const fail = (message) => {
  console.error(`Desktop Adult Stage 0 readiness invalid: ${message}`);
  process.exit(1);
};
const read = (file, label) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    fail(`${label} could not be read`);
  }
};
const readBytes = (file, label) => {
  try {
    return fs.readFileSync(file);
  } catch {
    fail(`${label} could not be read`);
  }
};
const isTimestamp = (value) =>
  typeof value === "string" &&
  !Number.isNaN(Date.parse(value)) &&
  value === new Date(value).toISOString();
const scanPrivateData = (value, location = "stage0Plan") => {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      scanPrivateData(item, `${location}[${index}]`),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKeys.test(key)) fail(`${location}.${key} is prohibited`);
      scanPrivateData(item, `${location}.${key}`);
    }
    return;
  }
  if (
    typeof value === "string" &&
    (emailPattern.test(value) || absolutePathPattern.test(value))
  ) {
    fail(`${location} contains personal data or a local path`);
  }
};
const exactKeys = (value, keys, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object`);
  const allowed = new Set(keys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = keys.filter((key) => !Object.hasOwn(value, key));
  if (unknown.length)
    fail(`${label} has unsupported fields: ${unknown.join(", ")}`);
  if (missing.length) fail(`${label} is missing fields: ${missing.join(", ")}`);
};

const plan = read(paths.plan, "Stage 0 plan");
scanPrivateData(plan);
exactKeys(plan, exactPlanKeys, "Stage 0 plan");
if (
  plan.format !== "mangai.desktop-adult-stage0-plan" ||
  plan.version !== 1 ||
  !candidateIdPattern.test(plan.candidateId ?? "") ||
  !isTimestamp(plan.scheduledStartAt) ||
  !isTimestamp(plan.deleteBy)
)
  fail("Stage 0 plan format, candidateId, or timestamp is unsupported");
const scheduledAt = Date.parse(plan.scheduledStartAt);
const deleteAt = Date.parse(plan.deleteBy);
if (
  deleteAt <= scheduledAt ||
  deleteAt <= Date.now() ||
  deleteAt - scheduledAt > 14 * 24 * 60 * 60 * 1000
)
  fail(
    "Stage 0 deletion deadline must be after the session and within 14 days",
  );

const bundle = read(paths.bundle, "bundle");
const approvals = read(paths.approvals, "approvals");
const desktopPackage = read(paths.desktopPackage, "Desktop package");
if (
  bundle.format !== "mangai.desktop-adult-pilot-bundle" ||
  bundle.version !== 1 ||
  approvals.format !== "mangai.desktop-adult-pilot-release-approvals" ||
  approvals.version !== 1
)
  fail("bundle or approval format is unsupported");

let assessment;
if (paths.assessment) {
  assessment = read(paths.assessment, "candidate assessment");
  scanPrivateData(assessment, "candidateAssessment");
  exactKeys(assessment, exactAssessmentKeys, "candidate assessment");
  exactKeys(
    assessment.environment,
    exactEnvironmentKeys,
    "candidate assessment environment",
  );
  if (
    assessment.format !== "mangai.desktop-adult-technical-monitor-assessment" ||
    assessment.version !== 1 ||
    !candidateIdPattern.test(assessment.candidateId ?? "") ||
    !isTimestamp(assessment.evaluatedAt) ||
    !Array.isArray(assessment.failedChecks) ||
    !Array.isArray(assessment.warnings) ||
    assessment.distributionAuthorized !== false ||
    assessment.nextStep !==
      "signed_acceptance_artifact_and_release_readiness_required"
  )
    fail("candidate assessment format is unsupported");
}

let artifactEvidence;
if (paths.artifactEvidence) {
  artifactEvidence = read(paths.artifactEvidence, "Stage 0 artifact evidence");
  scanPrivateData(artifactEvidence, "stage0ArtifactEvidence");
  exactKeys(
    artifactEvidence,
    exactArtifactEvidenceKeys,
    "Stage 0 artifact evidence",
  );
  exactKeys(
    artifactEvidence.signatures,
    exactSignatureKeys,
    "Stage 0 artifact evidence signatures",
  );
  exactKeys(
    artifactEvidence.artifacts,
    exactArtifactDigestKeys,
    "Stage 0 artifact evidence digests",
  );
  if (
    artifactEvidence.format !==
      "mangai.desktop-adult-stage0-artifact-evidence" ||
    artifactEvidence.version !== 1 ||
    !isTimestamp(artifactEvidence.generatedAt) ||
    artifactEvidence.artifactPurpose !== "stage0_acceptance_only" ||
    artifactEvidence.distributionAuthorized !== false ||
    artifactEvidence.signatures.installerStatus !== "Valid" ||
    artifactEvidence.signatures.productExecutableStatus !== "Valid" ||
    artifactEvidence.signatures.sameSigner !== true ||
    Object.values(artifactEvidence.artifacts).some(
      (digest) => !/^[a-f0-9]{64}$/.test(digest),
    )
  )
    fail("Stage 0 artifact evidence format or verification is unsupported");
}

let bundleEvidence;
let bundleEvidenceBytes;
if (paths.bundleEvidence) {
  bundleEvidenceBytes = readBytes(
    paths.bundleEvidence,
    "Stage 0 bundle evidence",
  );
  bundleEvidence = read(paths.bundleEvidence, "Stage 0 bundle evidence");
  scanPrivateData(bundleEvidence, "stage0BundleEvidence");
  exactKeys(bundleEvidence, exactBundleEvidenceKeys, "Stage 0 bundle evidence");
  if (!Array.isArray(bundleEvidence.artifacts))
    fail("Stage 0 bundle evidence artifacts must be an array");
  bundleEvidence.artifacts.forEach((artifact, index) =>
    exactKeys(
      artifact,
      exactBundleEvidenceArtifactKeys,
      `Stage 0 bundle evidence artifact ${index}`,
    ),
  );
  if (
    bundleEvidence.format !== "mangai.desktop-adult-pilot-bundle-evidence" ||
    bundleEvidence.version !== 1 ||
    !isTimestamp(bundleEvidence.checkedAt) ||
    !sha256Pattern.test(bundleEvidence.manifestSha256 ?? "")
  )
    fail("Stage 0 bundle evidence format or timestamp is unsupported");
}

const bundleItems = [
  bundle.comfyui,
  ...(bundle.workflows ?? []),
  ...(bundle.models ?? []),
];
const bundleVerification = bundle.verification;
if (bundleVerification) {
  exactKeys(
    bundleVerification,
    exactBundleVerificationKeys,
    "bundle verification",
  );
  if (!Array.isArray(bundleVerification.artifacts))
    fail("bundle verification artifacts must be an array");
  if (!Array.isArray(bundleVerification.workflows))
    fail("bundle verification workflows must be an array");
  bundleVerification.artifacts.forEach((artifact, index) =>
    exactKeys(
      artifact,
      exactBundleEvidenceArtifactKeys,
      `bundle verification artifact ${index}`,
    ),
  );
  bundleVerification.workflows.forEach((workflow, index) =>
    exactKeys(
      workflow,
      exactBundleWorkflowKeys,
      `bundle verification workflow ${index}`,
    ),
  );
}
const exactIds = (items, required, key) =>
  Array.isArray(items) &&
  items.length === required.length &&
  new Set(items.map((item) => item?.[key])).size === required.length &&
  required.every((id) => items.some((item) => item?.[key] === id));
const expectedBundleArtifacts = [
  {
    id: "runtime",
    bytes: bundle.comfyui?.installedBytes,
    sha256: bundle.comfyui?.sha256,
  },
  ...(bundle.models ?? []).map((model) => ({
    id: model?.role,
    bytes: model?.installedBytes,
    sha256: model?.sha256,
  })),
];
const expectedBundleWorkflows = (bundle.workflows ?? []).map((workflow) => ({
  operation: workflow?.operation,
  sha256: workflow?.sha256,
  mappingSha256: workflow?.mappingSha256,
}));
const sameRecords = (expected, actual, idKey, fields) =>
  exactIds(
    expected,
    expected.map((item) => item[idKey]),
    idKey,
  ) &&
  exactIds(
    actual,
    expected.map((item) => item[idKey]),
    idKey,
  ) &&
  expected.every((item) => {
    const match = actual.find(
      (candidate) => candidate?.[idKey] === item[idKey],
    );
    return fields.every((field) => match?.[field] === item[field]);
  });
const bundleReady =
  bundleItems.length === 8 &&
  bundle.comfyui?.status === "fixed" &&
  bundle.comfyui?.reviewStatus === "local_bundle_evidence_verified" &&
  (bundle.models ?? []).length === 3 &&
  bundle.models.every(
    (item) =>
      item?.status === "fixed" &&
      item?.reviewStatus === "local_bundle_evidence_verified",
  ) &&
  (bundle.workflows ?? []).length === 4 &&
  bundle.workflows.every(
    (item) =>
      item?.status === "fixed" &&
      item?.reviewStatus === "repository_hash_verified",
  ) &&
  bundleEvidence &&
  bundleVerification?.format ===
    "mangai.desktop-adult-pilot-bundle-verification" &&
  bundleVerification.version === 1 &&
  bundleVerification.evidenceCheckedAt === bundleEvidence.checkedAt &&
  bundleVerification.sourceManifestSha256 === bundleEvidence.manifestSha256 &&
  bundleVerification.evidenceSha256 ===
    crypto.createHash("sha256").update(bundleEvidenceBytes).digest("hex") &&
  exactIds(bundleEvidence.artifacts, requiredBundleArtifactIds, "id") &&
  exactIds(bundleVerification.artifacts, requiredBundleArtifactIds, "id") &&
  exactIds(
    bundleVerification.workflows,
    requiredBundleOperations,
    "operation",
  ) &&
  sameRecords(expectedBundleArtifacts, bundleEvidence.artifacts, "id", [
    "bytes",
    "sha256",
  ]) &&
  sameRecords(expectedBundleArtifacts, bundleVerification.artifacts, "id", [
    "bytes",
    "sha256",
  ]) &&
  sameRecords(
    expectedBundleWorkflows,
    bundleVerification.workflows,
    "operation",
    ["sha256", "mappingSha256"],
  ) &&
  [...bundleEvidence.artifacts, ...bundleVerification.artifacts].every(
    (item) =>
      Number.isSafeInteger(item?.bytes) &&
      item.bytes > 0 &&
      sha256Pattern.test(item?.sha256 ?? ""),
  ) &&
  bundleVerification.workflows.every(
    (item) =>
      sha256Pattern.test(item?.sha256 ?? "") &&
      sha256Pattern.test(item?.mappingSha256 ?? ""),
  );
const approvalsReady =
  approvals.pilotStartApproved === true &&
  approvals.manualVersionStopConstraintAccepted === true &&
  isTimestamp(approvals.approvedAt);
const candidateReady =
  assessment?.eligible === true &&
  assessment.failedChecks.length === 0 &&
  assessment.candidateId === plan.candidateId &&
  assessment.environment.windows === "windows_11" &&
  assessment.environment.gpuVendor === "nvidia" &&
  ["12gb", "16gb_or_more"].includes(assessment.environment.vramBand) &&
  ["16_to_31gb", "32gb_or_more"].includes(assessment.environment.ramBand) &&
  ["40_to_49gb", "50gb_or_more"].includes(assessment.environment.freeDiskBand);
const signedArtifactReady =
  artifactEvidence?.artifactVersion === desktopPackage.version &&
  artifactEvidence.artifactVersion === plan.artifactVersion &&
  plan.artifactVersion === desktopPackage.version &&
  plan.artifactPurpose === "stage0_acceptance_only" &&
  plan.artifactSeparatedFromStage1 === true &&
  plan.stage1DistributionAuthorized === false;
const assistedPlanReady =
  plan.assistedSessionConfirmed === true &&
  plan.stopContactConfirmed === true &&
  plan.evidenceTransferConfirmed === true;

const checks = [
  ["candidate_assessment", candidateReady],
  ["signed_acceptance_artifact", signedArtifactReady],
  ["fixed_bundle", bundleReady],
  ["owner_approvals", approvalsReady],
  ["assisted_session_and_stop_plan", assistedPlanReady],
];
for (const [id, ready] of checks)
  console.log(`${id}: ${ready ? "READY" : "BLOCKED"}`);
const blocked = checks.filter(([, ready]) => !ready).map(([id]) => id);
console.log(
  `Desktop Adult Stage 0 readiness: ready=${checks.length - blocked.length}, blocked=${blocked.length}, stage0Ready=${blocked.length === 0}, stage1DistributionAuthorized=false`,
);
console.log("hardware_12gb_four_modes: COLLECT_DURING_STAGE0");
if (blocked.length) console.log(`Blocked: ${blocked.join(", ")}`);
if (strict && blocked.length) process.exit(1);
