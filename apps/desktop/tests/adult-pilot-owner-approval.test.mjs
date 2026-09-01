import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = path.resolve(import.meta.dirname, "../scripts/record-adult-pilot-owner-approval.mjs");
const initial = {
  format: "mangai.desktop-adult-pilot-release-approvals",
  version: 1,
  pilotStartApproved: false,
  manualVersionStopConstraintAccepted: false,
  approvedAt: null,
};
const fixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-owner-approval-"));
  const file = path.join(root, "approval.json");
  fs.writeFileSync(file, JSON.stringify(initial));
  return { root, file };
};
const run = (file, args) => spawnSync(process.execPath, [script, ...args], {
  encoding: "utf8",
  env: { ...process.env, MANGAI_ADULT_PILOT_RELEASE_APPROVALS_PATH: file },
});

test("Adult Pilot owner approval requires both explicit acknowledgements", () => {
  for (const args of [[], ["--approve-pilot-start"], ["--accept-manual-version-stop"]]) {
    const { root, file } = fixture();
    assert.equal(run(file, args).status, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), initial);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Adult Pilot owner approval records both decisions atomically", () => {
  const { root, file } = fixture();
  const result = run(file, ["--approve-pilot-start", "--accept-manual-version-stop"]);
  assert.equal(result.status, 0, result.stderr);
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(saved.pilotStartApproved, true);
  assert.equal(saved.manualVersionStopConstraintAccepted, true);
  assert.equal(saved.approvedAt, new Date(saved.approvedAt).toISOString());
  assert.equal(run(file, ["--approve-pilot-start", "--accept-manual-version-stop"]).status, 1);
  fs.rmSync(root, { recursive: true, force: true });
});
