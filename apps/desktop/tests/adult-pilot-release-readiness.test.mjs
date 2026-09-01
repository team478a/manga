import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const script = path.resolve(import.meta.dirname, "../scripts/check-adult-pilot-release-readiness.mjs");
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

test("Adult Pilot release readiness reports repository-ready and external blockers separately", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  for (const id of ["consent_and_local_boundary", "diagnostic_privacy", "stop_recovery_runbook", "invite_ledger", "owner_approvals"])
    assert.match(result.stdout, new RegExp(`${id}: READY`));
  for (const id of ["signed_artifacts", "fixed_bundle", "hardware_12gb_four_modes"])
    assert.match(result.stdout, new RegExp(`${id}: BLOCKED`));
  assert.match(result.stdout, /ready=5, blocked=3/);
});

test("Adult Pilot strict release readiness stays fail-closed", () => {
  const result = run("--strict");
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Blocked: signed_artifacts, fixed_bundle, hardware_12gb_four_modes/);
});
