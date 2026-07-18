import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const file = path.join(
  root,
  "docs",
  "desktop",
  "PHASE5_HARDWARE_ACCEPTANCE.json",
);
const strict = process.argv.includes("--strict");
const allowedStatus = new Set(["pending", "passed", "blocked"]);
const requiredProfiles = ["vram_8gb", "vram_12gb", "vram_16gb"];

const fail = (message) => {
  console.error(`Phase 5 hardware acceptance invalid: ${message}`);
  process.exit(1);
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
const profileMap = new Map(document.profiles.map((item) => [item.profile, item]));
for (const profile of requiredProfiles) {
  const item = profileMap.get(profile);
  if (!item || !allowedStatus.has(item.status))
    fail(`${profile} is missing or has an invalid status`);
  if (item.status === "passed") {
    if (!item.hardware || typeof item.hardware !== "object")
      fail(`${profile} passed without hardware information`);
    if (!item.checkedAt || Number.isNaN(Date.parse(item.checkedAt)))
      fail(`${profile} passed without a valid checkedAt`);
    if (!Array.isArray(item.evidence) || item.evidence.length < 4)
      fail(`${profile} passed without four workflow evidence entries`);
    const requiredEvidence = new Set([
      "text_to_image",
      "image_to_image",
      "controlnet",
      "inpainting",
    ]);
    for (const evidence of item.evidence) {
      if (!evidence || typeof evidence !== "object") continue;
      if (
        requiredEvidence.has(evidence.operation) &&
        evidence.result === "passed" &&
        typeof evidence.outputSha256 === "string" &&
        /^[0-9a-f]{64}$/.test(evidence.outputSha256)
      )
        requiredEvidence.delete(evidence.operation);
    }
    if (requiredEvidence.size)
      fail(`${profile} is missing verified operation evidence`);
  }
}
const counts = { pending: 0, passed: 0, blocked: 0 };
for (const profile of requiredProfiles)
  counts[profileMap.get(profile).status] += 1;
console.log(
  `Phase 5 hardware acceptance: passed=${counts.passed}, pending=${counts.pending}, blocked=${counts.blocked}`,
);
if (strict && counts.passed !== requiredProfiles.length) process.exit(1);
