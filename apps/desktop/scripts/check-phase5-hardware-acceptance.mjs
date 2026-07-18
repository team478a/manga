import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const file = process.env.MANGAI_PHASE5_HARDWARE_STATUS_PATH
  ? path.resolve(process.env.MANGAI_PHASE5_HARDWARE_STATUS_PATH)
  : path.join(root, "docs", "desktop", "PHASE5_HARDWARE_ACCEPTANCE.json");
const strict = process.argv.includes("--strict");
const importIndex = process.argv.indexOf("--import");
const importFile = importIndex >= 0 ? process.argv[importIndex + 1] : undefined;
const allowedStatus = new Set(["pending", "passed", "blocked"]);
const requiredProfiles = ["vram_8gb", "vram_12gb", "vram_16gb"];
const requiredOperations = [
  "text_to_image",
  "image_to_image",
  "controlnet",
  "inpainting",
];
const sha256Pattern = /^[0-9a-f]{64}$/;

const fail = (message) => {
  console.error(`Phase 5 hardware acceptance invalid: ${message}`);
  process.exit(1);
};
const validDate = (value) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));
const validHardware = (hardware, profile) => {
  if (
    !hardware ||
    typeof hardware !== "object" ||
    !Number.isInteger(hardware.totalRamBytes) ||
    hardware.totalRamBytes <= 0 ||
    typeof hardware.gpuName !== "string" ||
    !hardware.gpuName.trim() ||
    !Number.isInteger(hardware.dedicatedVramMb)
  )
    return false;
  const ranges = {
    vram_8gb: [8 * 1024, 12 * 1024],
    vram_12gb: [12 * 1024, 16 * 1024],
    vram_16gb: [16 * 1024, Number.POSITIVE_INFINITY],
  };
  const [minimum, maximum] = ranges[profile];
  return (
    hardware.dedicatedVramMb >= minimum &&
    hardware.dedicatedVramMb < maximum
  );
};
const validateOperations = (operations, label) => {
  if (!Array.isArray(operations)) fail(`${label} has no operation evidence`);
  for (const operation of requiredOperations) {
    const evidence = operations.find((item) => item?.operation === operation);
    if (
      !evidence ||
      evidence.result !== "passed" ||
      !sha256Pattern.test(evidence.outputSha256 ?? "") ||
      !validDate(evidence.completedAt)
    )
      fail(`${label} is missing verified ${operation} evidence`);
  }
};
const validateExport = (value, label) => {
  if (
    !value ||
    !sha256Pattern.test(value.pdfSha256 ?? "") ||
    !sha256Pattern.test(value.salesPackageSha256 ?? "") ||
    !validDate(value.createdAt)
  )
    fail(`${label} is missing verified export evidence`);
};

let document;
try {
  document = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {
  fail("status file could not be read");
}
if (
  document.format !== "mangai.phase5-hardware-acceptance" ||
  document.version !== 1 ||
  !Array.isArray(document.profiles)
)
  fail("format or version is unsupported");

if (importIndex >= 0) {
  if (!importFile) fail("--import requires an evidence JSON path");
  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(path.resolve(importFile), "utf8"));
  } catch {
    fail("evidence file could not be read");
  }
  if (
    evidence.format !== "mangai.phase5-hardware-evidence" ||
    evidence.version !== 1 ||
    !requiredProfiles.includes(evidence.profile) ||
    !sha256Pattern.test(evidence.projectIdSha256 ?? "") ||
    !validDate(evidence.checkedAt)
  )
    fail("evidence format or metadata is unsupported");
  if (!validHardware(evidence.hardware, evidence.profile))
    fail(`${evidence.profile} hardware is outside the required VRAM range`);
  validateOperations(evidence.operations, evidence.profile);
  validateExport(evidence.export, evidence.profile);
  const target = document.profiles.find(
    (item) => item.profile === evidence.profile,
  );
  if (!target) fail(`${evidence.profile} is missing from the status file`);
  Object.assign(target, {
    status: "passed",
    hardware: evidence.hardware,
    checkedAt: evidence.checkedAt,
    evidence: evidence.operations,
    export: evidence.export,
    notes: "MANGAI Desktopが生成した実機証跡JSONから登録",
  });
  document.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, {
    mode: 0o600,
  });
  console.log(`Imported ${evidence.profile} evidence into ${file}`);
}

const profileMap = new Map(document.profiles.map((item) => [item.profile, item]));
for (const profile of requiredProfiles) {
  const item = profileMap.get(profile);
  if (!item || !allowedStatus.has(item.status))
    fail(`${profile} is missing or has an invalid status`);
  if (item.status === "passed") {
    if (!validHardware(item.hardware, profile))
      fail(`${profile} passed without matching hardware information`);
    if (!validDate(item.checkedAt))
      fail(`${profile} passed without a valid checkedAt`);
    validateOperations(item.evidence, profile);
    validateExport(item.export, profile);
  }
}
const counts = { pending: 0, passed: 0, blocked: 0 };
for (const profile of requiredProfiles)
  counts[profileMap.get(profile).status] += 1;
console.log(
  `Phase 5 hardware acceptance: passed=${counts.passed}, pending=${counts.pending}, blocked=${counts.blocked}`,
);
if (strict && counts.passed !== requiredProfiles.length) process.exit(1);
