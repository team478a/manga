import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const candidatePath = path.resolve(
  process.env.MANGAI_ADULT_PILOT_TECHNICAL_MONITOR_CANDIDATE_PATH ??
    path.join(
      root,
      "docs",
      "desktop",
      "DESKTOP_ADULT_TECHNICAL_MONITOR_CANDIDATE.example.json",
    ),
);
const strict = process.argv.includes("--strict");
const resultIndex = process.argv.indexOf("--result-out");
const resultPath = resultIndex >= 0 ? process.argv[resultIndex + 1] : undefined;

const isInside = (parent, child) => {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

const forbiddenKeys =
  /^(name|email|address|phone|prompt|negativePrompt|image|mask|projectName|deviceName|hostname|serialNumber|ipAddress|macAddress|absolutePath|content|notes?)$/i;
const emailPattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const absolutePathPattern =
  /(?:[a-z]:\\|\\\\[^\\]+\\|file:\/\/|\/(?:home|users|var|tmp)\/)/i;
const candidateIdPattern = /^candidate-[0-9a-f]{12}$/;
const requiredConfirmations = [
  "age18OrOlder",
  "fictionalAdultsOnly",
  "prohibitedContentPolicy",
  "localOnlyBoundary",
  "officialSourceDownloads",
  "contentFreeDiagnostics",
  "localBackupResponsibility",
  "manualStopProcedure",
];
const allowedTopLevelKeys = [
  "format",
  "version",
  "candidateId",
  "confirmedAt",
  "environment",
  "availability",
  "confirmations",
];

const fail = (message) => {
  console.error(
    `Desktop Adult technical monitor candidate invalid: ${message}`,
  );
  process.exit(1);
};
const isTimestamp = (value) =>
  typeof value === "string" &&
  !Number.isNaN(Date.parse(value)) &&
  value === new Date(value).toISOString();
const assertExactKeys = (value, keys, location) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${location} must be an object`);
  }
  const allowed = new Set(keys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = keys.filter((key) => !Object.hasOwn(value, key));
  if (unknown.length)
    fail(`${location} has unsupported fields: ${unknown.join(", ")}`);
  if (missing.length)
    fail(`${location} is missing fields: ${missing.join(", ")}`);
};
const scanPrivateData = (value, location = "candidate") => {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      scanPrivateData(item, `${location}[${index}]`),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKeys.test(key))
        fail(`${location}.${key} is a prohibited field`);
      scanPrivateData(item, `${location}.${key}`);
    }
    return;
  }
  if (
    typeof value === "string" &&
    (emailPattern.test(value) || absolutePathPattern.test(value))
  ) {
    fail(`${location} contains prohibited personal data or a local path`);
  }
};

let candidate;
try {
  candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
} catch {
  fail("candidate file could not be read");
}
scanPrivateData(candidate);
assertExactKeys(candidate, allowedTopLevelKeys, "candidate");
if (
  candidate.format !== "mangai.desktop-adult-technical-monitor-candidate" ||
  candidate.version !== 1 ||
  !candidateIdPattern.test(candidate.candidateId ?? "") ||
  !isTimestamp(candidate.confirmedAt)
) {
  fail("format, version, candidateId, or confirmedAt is unsupported");
}

const environment = candidate.environment ?? {};
const confirmations = candidate.confirmations ?? {};
const availability = candidate.availability ?? {};
assertExactKeys(
  environment,
  ["windows", "gpuVendor", "vramBand", "ramBand", "freeDiskBand"],
  "candidate.environment",
);
assertExactKeys(
  availability,
  ["assistedFirstRun", "observation24Hours"],
  "candidate.availability",
);
assertExactKeys(
  confirmations,
  requiredConfirmations,
  "candidate.confirmations",
);
if (!new Set(["windows_11", "other"]).has(environment.windows))
  fail("candidate.environment.windows is unsupported");
if (!new Set(["nvidia", "other"]).has(environment.gpuVendor))
  fail("candidate.environment.gpuVendor is unsupported");
if (!new Set(["under_12gb", "12gb", "16gb_or_more"]).has(environment.vramBand))
  fail("candidate.environment.vramBand is unsupported");
if (
  !new Set(["under_16gb", "16_to_31gb", "32gb_or_more"]).has(
    environment.ramBand,
  )
)
  fail("candidate.environment.ramBand is unsupported");
if (
  !new Set(["under_40gb", "40_to_49gb", "50gb_or_more"]).has(
    environment.freeDiskBand,
  )
)
  fail("candidate.environment.freeDiskBand is unsupported");
const checks = [
  ["windows_11", environment.windows === "windows_11"],
  ["nvidia_gpu", environment.gpuVendor === "nvidia"],
  [
    "vram_12gb_or_more",
    ["12gb", "16gb_or_more"].includes(environment.vramBand),
  ],
  [
    "ram_16gb_or_more",
    ["16_to_31gb", "32gb_or_more"].includes(environment.ramBand),
  ],
  [
    "free_disk_40gb_or_more",
    ["40_to_49gb", "50gb_or_more"].includes(environment.freeDiskBand),
  ],
  ["assisted_first_run", availability.assistedFirstRun === true],
  ["observation_24_hours", availability.observation24Hours === true],
  ...requiredConfirmations.map((id) => [
    `confirmation_${id}`,
    confirmations[id] === true,
  ]),
];
const warnings = [];
if (environment.ramBand === "16_to_31gb")
  warnings.push("ram_below_recommended_32gb");
if (environment.freeDiskBand === "40_to_49gb")
  warnings.push("disk_below_recommended_50gb");
const failedChecks = checks.filter(([, passed]) => !passed).map(([id]) => id);
const eligible = failedChecks.length === 0;

const assessment = {
  format: "mangai.desktop-adult-technical-monitor-assessment",
  version: 1,
  candidateId: candidate.candidateId,
  evaluatedAt: new Date().toISOString(),
  eligible,
  environment: {
    windows: environment.windows ?? null,
    gpuVendor: environment.gpuVendor ?? null,
    vramBand: environment.vramBand ?? null,
    ramBand: environment.ramBand ?? null,
    freeDiskBand: environment.freeDiskBand ?? null,
  },
  failedChecks,
  warnings,
  distributionAuthorized: false,
  nextStep: eligible
    ? "signed_acceptance_artifact_and_release_readiness_required"
    : "candidate_requirements_not_met",
};

if (resultIndex >= 0) {
  if (!resultPath) fail("--result-out requires a JSON path");
  if (!path.isAbsolute(resultPath) || resultPath.startsWith("\\\\"))
    fail("result output must be an absolute local-drive path");
  const output = path.resolve(resultPath);
  if (isInside(root, output))
    fail("result output must be outside the Git repository");
  const parent = path.dirname(output);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory())
    fail("result output directory does not exist");
  if (fs.existsSync(output)) fail("result output already exists");
  try {
    fs.writeFileSync(output, `${JSON.stringify(assessment, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
  } catch {
    fail("result output could not be written");
  }
}

console.log(
  `Desktop Adult technical monitor candidate: eligible=${eligible}, failed=${failedChecks.length}, warnings=${warnings.length}, privateData=none, distributionAuthorized=false`,
);
if (failedChecks.length) console.log(`Failed: ${failedChecks.join(", ")}`);
if (warnings.length) console.log(`Warnings: ${warnings.join(", ")}`);
if (strict && !eligible) process.exit(1);
