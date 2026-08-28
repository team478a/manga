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
