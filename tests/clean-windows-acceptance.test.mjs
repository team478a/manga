import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const script = fileURLToPath(new URL(
  "../apps/desktop/scripts/check-clean-windows-acceptance.mjs",
  import.meta.url,
));
const status = new URL(
  "../docs/desktop/CLEAN_WINDOWS_ACCEPTANCE.json",
  import.meta.url,
);
const ledger = new URL(
  "../docs/desktop/RC_ACCEPTANCE_STATUS.json",
  import.meta.url,
);
const checkIds = [
  "clean_environment",
  "valid_authenticode",
  "install_and_launch",
  "project_create_and_export",
  "signed_update",
  "project_data_preserved",
  "uninstall",
];
const validEvidence = () => ({
  format: "mangai.clean-windows-evidence",
  version: 1,
  operatorRole: "release-operator",
  checkedAt: "2026-08-29T00:00:00.000Z",
  environment: {
    kind: "reset-vm",
    cleanInstallConfirmed: true,
    windowsVersion: "Windows 11 Pro",
    build: 26100,
    machineIdSha256: "d".repeat(64),
  },
  artifacts: {
    oldVersion: "0.1.0",
    newVersion: "0.1.1",
    oldInstallerSha256: "a".repeat(64),
    newInstallerSha256: "b".repeat(64),
    exportSha256: "c".repeat(64),
  },
  checks: checkIds.map((id) => ({
    id,
    result: "passed",
    completedAt: "2026-08-29T00:00:00.000Z",
  })),
});

test("clean Windows preflight reports current external blockers without strict failure", () => {
  const output = execFileSync(process.execPath, [script], { encoding: "utf8" });
  assert.match(output, /passed=0, pending=5, blocked=2/);
  assert.match(output, /Code signing gate: not ready/);
  assert.match(output, /Signed update gate: not ready/);
  assert.match(output, /Result: BLOCKED/);
  assert.throws(() => execFileSync(process.execPath, [script, "--strict"]));
});

test("clean Windows acceptance cannot pass without signed prerequisites", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-clean-windows-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const statusCopy = path.join(directory, "status.json");
  const document = JSON.parse(fs.readFileSync(status, "utf8"));
  document.status = "passed";
  document.completedAt = "2026-08-28T00:00:00.000Z";
  document.verifier = "Acceptance operator";
  document.artifacts = {
    oldVersion: "0.1.0",
    newVersion: "0.1.1",
    oldInstallerSha256: "a".repeat(64),
    newInstallerSha256: "b".repeat(64),
    exportSha256: "c".repeat(64),
  };
  document.checks = document.checks.map((check) => ({
    id: check.id,
    status: "passed",
    completedAt: "2026-08-28T00:00:00.000Z",
    evidence: ["operator-confirmed"],
  }));
  fs.writeFileSync(statusCopy, JSON.stringify(document));
  assert.throws(() =>
    execFileSync(process.execPath, [script], {
      env: {
        ...process.env,
        MANGAI_CLEAN_WINDOWS_STATUS_PATH: statusCopy,
        MANGAI_RC_ACCEPTANCE_PATH: fileURLToPath(ledger),
      },
      stdio: "pipe",
    }),
  );
});

test("clean Windows evidence import synchronizes status and RC ledger", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-clean-import-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const statusCopy = path.join(directory, "status.json");
  const ledgerCopy = path.join(directory, "ledger.json");
  const evidenceFile = path.join(directory, "evidence.json");
  fs.copyFileSync(status, statusCopy);
  const ledgerDocument = JSON.parse(fs.readFileSync(ledger, "utf8"));
  for (const id of ["windows-code-signing", "signed-auto-update"]) {
    const gate = ledgerDocument.requirements.find((item) => item.id === id);
    Object.assign(gate, {
      status: "passed",
      completedAt: "2026-08-29",
      verifier: "release-operator",
      evidence: ["signed-release-evidence"],
    });
    delete gate.reason;
  }
  fs.writeFileSync(ledgerCopy, JSON.stringify(ledgerDocument));
  fs.writeFileSync(evidenceFile, JSON.stringify(validEvidence()));

  const output = execFileSync(process.execPath, [script, "--import", evidenceFile], {
    env: {
      ...process.env,
      MANGAI_CLEAN_WINDOWS_STATUS_PATH: statusCopy,
      MANGAI_RC_ACCEPTANCE_PATH: ledgerCopy,
    },
    encoding: "utf8",
  });
  assert.match(output, /Imported clean Windows evidence/);
  assert.match(output, /Result: PASSED/);
  const importedStatus = JSON.parse(fs.readFileSync(statusCopy, "utf8"));
  const importedLedger = JSON.parse(fs.readFileSync(ledgerCopy, "utf8"));
  assert.equal(importedStatus.status, "passed");
  assert.equal(importedStatus.checks.length, 7);
  assert.equal(
    importedLedger.requirements.find((item) => item.id === "clean-windows-acceptance")
      .status,
    "passed",
  );
});

test("clean Windows evidence import rejects unknown, duplicate, or sensitive-shaped fields", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-clean-invalid-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const statusCopy = path.join(directory, "status.json");
  const ledgerCopy = path.join(directory, "ledger.json");
  const evidenceFile = path.join(directory, "evidence.json");
  fs.copyFileSync(status, statusCopy);
  const ledgerDocument = JSON.parse(fs.readFileSync(ledger, "utf8"));
  for (const id of ["windows-code-signing", "signed-auto-update"])
    ledgerDocument.requirements.find((item) => item.id === id).status = "passed";
  fs.writeFileSync(ledgerCopy, JSON.stringify(ledgerDocument));
  const evidence = validEvidence();
  evidence.operatorRole = "operator@example.com";
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence));
  assert.throws(() =>
    execFileSync(process.execPath, [script, "--import", evidenceFile], {
      env: {
        ...process.env,
        MANGAI_CLEAN_WINDOWS_STATUS_PATH: statusCopy,
        MANGAI_RC_ACCEPTANCE_PATH: ledgerCopy,
      },
      stdio: "pipe",
    }),
  );
  assert.equal(JSON.parse(fs.readFileSync(statusCopy, "utf8")).status, "blocked");
});

test("clean Windows acceptance contract is documented and wired", () => {
  const packageJson = fs.readFileSync(new URL("../package.json", import.meta.url), "utf8");
  const guide = fs.readFileSync(
    new URL("../docs/desktop/CLEAN_WINDOWS_ACCEPTANCE.md", import.meta.url),
    "utf8",
  );
  assert.match(packageJson, /rc:clean-windows-acceptance/);
  assert.match(guide, /Windows Sandbox|初期化済みVM|新規PC/);
  assert.match(guide, /署名済み2version/);
  assert.match(guide, /Production、Provider、credit/);
});
