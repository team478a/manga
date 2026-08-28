import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const statusPath = process.env.MANGAI_CLEAN_WINDOWS_STATUS_PATH
  ? path.resolve(process.env.MANGAI_CLEAN_WINDOWS_STATUS_PATH)
  : path.join(root, "docs", "desktop", "CLEAN_WINDOWS_ACCEPTANCE.json");
const ledgerPath = process.env.MANGAI_RC_ACCEPTANCE_PATH
  ? path.resolve(process.env.MANGAI_RC_ACCEPTANCE_PATH)
  : path.join(root, "docs", "desktop", "RC_ACCEPTANCE_STATUS.json");
const strict = process.argv.includes("--strict");
const requiredChecks = [
  "clean_environment",
  "valid_authenticode",
  "install_and_launch",
  "project_create_and_export",
  "signed_update",
  "project_data_preserved",
  "uninstall",
];
const hashPattern = /^[0-9a-f]{64}$/;

const fail = (message) => {
  console.error(`Clean Windows acceptance invalid: ${message}`);
  process.exit(1);
};
const readJson = (file, label) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    fail(`${label} could not be read`);
  }
};
const validDate = (value) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

const document = readJson(statusPath, "status file");
const ledger = readJson(ledgerPath, "RC acceptance ledger");
if (
  document.format !== "mangai.clean-windows-acceptance" ||
  document.version !== 1 ||
  !["pending", "passed", "blocked"].includes(document.status) ||
  !Array.isArray(document.checks)
)
  fail("format, version, or status is unsupported");

const checks = new Map(document.checks.map((item) => [item?.id, item]));
for (const id of requiredChecks) {
  const check = checks.get(id);
  if (!check || !["pending", "passed", "blocked"].includes(check.status))
    fail(`${id} is missing or has an invalid status`);
  if (check.status === "blocked" && !check.reason?.trim())
    fail(`${id} blocked without a reason`);
  if (check.status === "passed") {
    if (!validDate(check.completedAt))
      fail(`${id} passed without a valid completedAt`);
    if (!Array.isArray(check.evidence) || check.evidence.length === 0)
      fail(`${id} passed without evidence`);
    if (check.evidence.some((item) => typeof item !== "string" || !item.trim()))
      fail(`${id} has invalid evidence`);
  }
}

if (document.status === "passed") {
  if (requiredChecks.some((id) => checks.get(id).status !== "passed"))
    fail("overall status passed while required checks remain incomplete");
  if (!validDate(document.completedAt) || !document.verifier?.trim())
    fail("passed status requires completedAt and verifier");
  for (const field of ["oldInstallerSha256", "newInstallerSha256", "exportSha256"])
    if (!hashPattern.test(document.artifacts?.[field] ?? ""))
      fail(`passed status requires ${field}`);
  if (document.artifacts.oldVersion === document.artifacts.newVersion)
    fail("signed update evidence requires two distinct versions");
}

const ledgerById = new Map(
  (ledger.requirements ?? []).map((item) => [item.id, item]),
);
const signingReady = ledgerById.get("windows-code-signing")?.status === "passed";
const updateReady = ledgerById.get("signed-auto-update")?.status === "passed";
if (document.status === "passed" && (!signingReady || !updateReady))
  fail("overall status passed before code signing and signed auto-update gates");

const counts = { pending: 0, passed: 0, blocked: 0 };
for (const id of requiredChecks) counts[checks.get(id).status] += 1;
console.log("MANGAI clean Windows acceptance");
console.log(`  Checks: passed=${counts.passed}, pending=${counts.pending}, blocked=${counts.blocked}`);
console.log(`  Code signing gate: ${signingReady ? "ready" : "not ready"}`);
console.log(`  Signed update gate: ${updateReady ? "ready" : "not ready"}`);
console.log(`  Result: ${document.status.toUpperCase()}`);

if (strict && document.status !== "passed") process.exit(1);
