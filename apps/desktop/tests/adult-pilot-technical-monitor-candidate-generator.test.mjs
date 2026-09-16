import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTechnicalMonitorCandidate } from "../scripts/create-adult-pilot-technical-monitor-candidate.mjs";

const preflightScript = path.resolve(
  import.meta.dirname,
  "../scripts/check-adult-pilot-technical-monitor-candidate.mjs",
);

const fixture = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-candidate-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, "repository");
  const privateRoot = path.join(root, "private");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(privateRoot);
  return {
    repositoryRoot,
    outputPath: path.join(privateRoot, "candidate.json"),
  };
};

const eligibleOptions = (values) => ({
  ...values,
  windows: "windows_11",
  gpuVendor: "nvidia",
  vramBand: "12gb",
  ramBand: "32gb_or_more",
  freeDiskBand: "50gb_or_more",
  assistedFirstRun: true,
  observation24Hours: true,
  age18OrOlder: true,
  fictionalAdultsOnly: true,
  prohibitedContentPolicy: true,
  localOnlyBoundary: true,
  officialSourceDownloads: true,
  contentFreeDiagnostics: true,
  localBackupResponsibility: true,
  manualStopProcedure: true,
  now: new Date("2026-09-16T00:00:00.000Z"),
  randomBytes: () => Buffer.from("012345abcdef", "hex"),
});

test("technical monitor candidate contains only categorical answers", (t) => {
  const values = fixture(t);
  const candidate = createTechnicalMonitorCandidate(eligibleOptions(values));
  assert.equal(candidate.candidateId, "candidate-012345abcdef");
  assert.equal(candidate.confirmedAt, "2026-09-16T00:00:00.000Z");
  assert.equal(candidate.confirmations.manualStopProcedure, true);
  const serialized = fs.readFileSync(values.outputPath, "utf8");
  assert.doesNotMatch(serialized, /@|name|email|prompt|absolutePath/i);
});

test("technical monitor candidate records omitted confirmations as false", (t) => {
  const values = fixture(t);
  const candidate = createTechnicalMonitorCandidate({
    ...eligibleOptions(values),
    assistedFirstRun: false,
    age18OrOlder: false,
  });
  assert.equal(candidate.availability.assistedFirstRun, false);
  assert.equal(candidate.confirmations.age18OrOlder, false);
  assert.equal(candidate.confirmations.fictionalAdultsOnly, true);
});

test("technical monitor candidate rejects unsafe output and overwrite", (t) => {
  const values = fixture(t);
  const options = eligibleOptions(values);
  createTechnicalMonitorCandidate(options);
  assert.throws(() => createTechnicalMonitorCandidate(options), /EEXIST/);
  assert.throws(
    () =>
      createTechnicalMonitorCandidate({
        ...options,
        outputPath: path.join(values.repositoryRoot, "candidate.json"),
      }),
    /Git管理外/,
  );
  assert.throws(
    () =>
      createTechnicalMonitorCandidate({
        ...options,
        outputPath: "candidate.json",
      }),
    /絶対path/,
  );
});

test("technical monitor candidate accepts only defined environment choices", (t) => {
  const values = fixture(t);
  const options = eligibleOptions(values);
  assert.throws(
    () => createTechnicalMonitorCandidate({ ...options, vramBand: "24gb" }),
    /選択肢/,
  );
  assert.throws(
    () =>
      createTechnicalMonitorCandidate({
        ...options,
        randomBytes: () => Buffer.alloc(5),
      }),
    /安全に生成/,
  );
});

test("generated eligible candidate passes the existing strict preflight", (t) => {
  const values = fixture(t);
  createTechnicalMonitorCandidate(eligibleOptions(values));
  const assessmentPath = path.join(
    path.dirname(values.outputPath),
    "assessment.json",
  );
  const result = spawnSync(
    process.execPath,
    [preflightScript, "--strict", "--result-out", assessmentPath],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        MANGAI_ADULT_PILOT_TECHNICAL_MONITOR_CANDIDATE_PATH: values.outputPath,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const assessment = JSON.parse(fs.readFileSync(assessmentPath, "utf8"));
  assert.equal(assessment.candidateId, "candidate-012345abcdef");
  assert.equal(assessment.eligible, true);
  assert.equal(assessment.distributionAuthorized, false);
});
