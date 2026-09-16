import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = path.resolve(
  import.meta.dirname,
  "../scripts/check-adult-pilot-technical-monitor-candidate.mjs",
);
const baseCandidate = (overrides = {}) => ({
  format: "mangai.desktop-adult-technical-monitor-candidate",
  version: 1,
  candidateId: "candidate-012345abcdef",
  confirmedAt: "2026-09-16T00:00:00.000Z",
  environment: {
    windows: "windows_11",
    gpuVendor: "nvidia",
    vramBand: "12gb",
    ramBand: "32gb_or_more",
    freeDiskBand: "50gb_or_more",
  },
  availability: {
    assistedFirstRun: true,
    observation24Hours: true,
  },
  confirmations: {
    age18OrOlder: true,
    fictionalAdultsOnly: true,
    prohibitedContentPolicy: true,
    localOnlyBoundary: true,
    officialSourceDownloads: true,
    contentFreeDiagnostics: true,
    localBackupResponsibility: true,
    manualStopProcedure: true,
  },
  ...overrides,
});
const run = (candidate, args = []) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-adult-monitor-"));
  const input = path.join(root, "candidate.json");
  fs.writeFileSync(input, JSON.stringify(candidate));
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      MANGAI_ADULT_PILOT_TECHNICAL_MONITOR_CANDIDATE_PATH: input,
    },
  });
  return { root, input, result };
};
const cleanup = (root) => fs.rmSync(root, { recursive: true, force: true });

test("Adult Pilot技術モニター候補は適格環境と全確認を受理する", () => {
  const { root, result } = run(baseCandidate(), ["--strict"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /eligible=true/);
  assert.match(result.stdout, /privateData=none/);
  assert.match(result.stdout, /distributionAuthorized=false/);
  cleanup(root);
});

test("Adult Pilot技術モニター候補は12GB未満または未確認項目をstrict拒否する", () => {
  for (const candidate of [
    baseCandidate({
      environment: {
        windows: "windows_11",
        gpuVendor: "nvidia",
        vramBand: "under_12gb",
        ramBand: "32gb_or_more",
        freeDiskBand: "50gb_or_more",
      },
    }),
    baseCandidate({
      confirmations: {
        ...baseCandidate().confirmations,
        manualStopProcedure: false,
      },
    }),
  ]) {
    const { root, result } = run(candidate, ["--strict"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /eligible=false/);
    cleanup(root);
  }
});

test("Adult Pilot技術モニター候補は個人情報・作品内容・local pathを拒否する", () => {
  for (const candidate of [
    baseCandidate({ email: "person@example.com" }),
    baseCandidate({ prompt: "content" }),
    baseCandidate({ supportValue: "C:\\Users\\person\\project" }),
  ]) {
    const { root, result } = run(candidate);
    assert.notEqual(result.status, 0);
    cleanup(root);
  }
});

test("Adult Pilot技術モニター候補は自由記述用の未知fieldを拒否する", () => {
  const { root, result } = run(
    baseCandidate({ storyDescription: "free text" }),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsupported fields/);
  cleanup(root);
});

test("Adult Pilot技術モニター判定は内容非保持assessmentを新規保存し上書きを拒否する", () => {
  const { root, input } = run(baseCandidate());
  const output = path.join(root, "assessment.json");
  const invoke = () =>
    spawnSync(process.execPath, [script, "--strict", "--result-out", output], {
      encoding: "utf8",
      env: {
        ...process.env,
        MANGAI_ADULT_PILOT_TECHNICAL_MONITOR_CANDIDATE_PATH: input,
      },
    });
  const firstResult = invoke();
  assert.equal(firstResult.status, 0, firstResult.stderr);
  const assessment = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(assessment.eligible, true);
  assert.equal(assessment.distributionAuthorized, false);
  assert.deepEqual(assessment.failedChecks, []);
  assert.equal(JSON.stringify(assessment).includes("@"), false);
  const secondResult = invoke();
  assert.notEqual(secondResult.status, 0);
  assert.match(secondResult.stderr, /already exists/);
  cleanup(root);
});
