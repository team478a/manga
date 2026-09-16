import fs from "node:fs";
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
  plan: fromEnv(
    "MANGAI_ADULT_PILOT_STAGE0_PLAN_PATH",
    "docs/desktop/DESKTOP_ADULT_STAGE0_PLAN.example.json",
  ),
  rc: fromEnv(
    "MANGAI_ADULT_PILOT_RC_STATUS_PATH",
    "docs/desktop/RC_ACCEPTANCE_STATUS.json",
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

const rc = read(paths.rc, "RC status");
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

const rcStatus = (id) =>
  rc.requirements?.find((item) => item?.id === id)?.status;
const bundleItems = [
  bundle.comfyui,
  ...(bundle.workflows ?? []),
  ...(bundle.models ?? []),
];
const bundleReady =
  bundleItems.length === 8 &&
  bundleItems.every((item) => item?.status === "fixed");
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
  rcStatus("windows-code-signing") === "passed" &&
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
