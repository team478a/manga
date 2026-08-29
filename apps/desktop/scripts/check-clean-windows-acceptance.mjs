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
const importIndex = process.argv.indexOf("--import");
const importPath = importIndex >= 0 ? process.argv[importIndex + 1] : undefined;
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

let document = readJson(statusPath, "status file");
let ledger = readJson(ledgerPath, "RC acceptance ledger");
if (
  document.format !== "mangai.clean-windows-acceptance" ||
  document.version !== 1 ||
  !["pending", "passed", "blocked"].includes(document.status) ||
  !Array.isArray(document.checks)
)
  fail("format, version, or status is unsupported");

const ledgerById = new Map(
  (ledger.requirements ?? []).map((item) => [item.id, item]),
);
const signingReady = ledgerById.get("windows-code-signing")?.status === "passed";
const updateReady = ledgerById.get("signed-auto-update")?.status === "passed";

if (importIndex >= 0) {
  if (!importPath) fail("--import requires an evidence JSON path");
  if (!signingReady || !updateReady)
    fail("evidence cannot be imported before code signing and signed auto-update gates");
  const evidence = readJson(path.resolve(importPath), "evidence file");
  if (
    evidence.format !== "mangai.clean-windows-evidence" ||
    evidence.version !== 1 ||
    evidence.operatorRole !== "release-operator" ||
    !validDate(evidence.checkedAt) ||
    !["windows-sandbox", "reset-vm", "new-pc"].includes(
      evidence.environment?.kind,
    ) ||
    evidence.environment?.cleanInstallConfirmed !== true ||
    typeof evidence.environment?.windowsVersion !== "string" ||
    !/^Windows 11(?:\s|$)/.test(evidence.environment.windowsVersion) ||
    !Number.isInteger(evidence.environment?.build) ||
    evidence.environment.build <= 0 ||
    !hashPattern.test(evidence.environment?.machineIdSha256 ?? "")
  )
    fail("evidence metadata or clean environment is invalid");
  for (const field of ["oldInstallerSha256", "newInstallerSha256", "exportSha256"])
    if (!hashPattern.test(evidence.artifacts?.[field] ?? ""))
      fail(`evidence requires ${field}`);
  if (
    !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(
      evidence.artifacts?.oldVersion ?? "",
    ) ||
    !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(
      evidence.artifacts?.newVersion ?? "",
    ) ||
    evidence.artifacts.oldVersion === evidence.artifacts.newVersion
  )
    fail("evidence requires two distinct versions");
  const importedChecks = new Map(
    (evidence.checks ?? []).map((item) => [item?.id, item]),
  );
  for (const id of requiredChecks) {
    const check = importedChecks.get(id);
    if (check?.result !== "passed" || !validDate(check.completedAt))
      fail(`evidence is missing passed ${id}`);
  }
  if (
    importedChecks.size !== requiredChecks.length ||
    evidence.checks.length !== requiredChecks.length
  )
    fail("evidence contains unknown or duplicate checks");

  document = {
    format: "mangai.clean-windows-acceptance",
    version: 1,
    status: "passed",
    updatedAt: evidence.checkedAt.slice(0, 10),
    completedAt: evidence.checkedAt,
    verifier: evidence.operatorRole,
    environment: evidence.environment,
    artifacts: evidence.artifacts,
    checks: requiredChecks.map((id) => ({
      id,
      status: "passed",
      completedAt: importedChecks.get(id).completedAt,
      evidence: [`mangai.clean-windows-evidence:${id}`],
    })),
  };
  const cleanWindowsGate = ledgerById.get("clean-windows-acceptance");
  if (!cleanWindowsGate) fail("RC acceptance ledger has no clean Windows gate");
  Object.assign(cleanWindowsGate, {
    status: "passed",
    completedAt: evidence.checkedAt.slice(0, 10),
    verifier: evidence.operatorRole,
    evidence: [
      "docs/desktop/CLEAN_WINDOWS_ACCEPTANCE.json",
      "docs/desktop/CLEAN_WINDOWS_ACCEPTANCE.md",
    ],
  });
  delete cleanWindowsGate.reason;
  ledger.updatedAt = evidence.checkedAt.slice(0, 10);

  const statusTemporary = `${statusPath}.tmp`;
  const ledgerTemporary = `${ledgerPath}.tmp`;
  const originalStatus = fs.readFileSync(statusPath);
  const originalLedger = fs.readFileSync(ledgerPath);
  try {
    fs.writeFileSync(statusTemporary, `${JSON.stringify(document, null, 2)}\n`, {
      mode: 0o600,
    });
    fs.writeFileSync(ledgerTemporary, `${JSON.stringify(ledger, null, 2)}\n`, {
      mode: 0o600,
    });
    fs.renameSync(statusTemporary, statusPath);
    fs.renameSync(ledgerTemporary, ledgerPath);
  } catch {
    fs.writeFileSync(statusPath, originalStatus, { mode: 0o600 });
    fs.writeFileSync(ledgerPath, originalLedger, { mode: 0o600 });
    fs.rmSync(statusTemporary, { force: true });
    fs.rmSync(ledgerTemporary, { force: true });
    fail("status and RC ledger could not be synchronized");
  }
  console.log(`Imported clean Windows evidence into ${statusPath}`);
}

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
