import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createStage0Plan } from "../scripts/create-adult-pilot-stage0-plan.mjs";

const now = new Date("2026-09-16T00:00:00.000Z");
const fixture = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-stage0-plan-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const desktopRoot = path.join(root, "desktop");
  const privateRoot = path.join(root, "private");
  fs.mkdirSync(desktopRoot);
  fs.mkdirSync(privateRoot);
  fs.writeFileSync(
    path.join(desktopRoot, "package.json"),
    JSON.stringify({ version: "0.1.0" }),
  );
  return {
    desktopRoot,
    outputPath: path.join(privateRoot, "plan.json"),
  };
};

const validOptions = (values) => ({
  ...values,
  candidateId: "candidate-a1b2c3d4e5f6",
  scheduledStartAt: "2026-09-20T00:00:00.000Z",
  deleteBy: "2026-09-27T00:00:00.000Z",
  assistedSessionConfirmed: true,
  stopContactConfirmed: true,
  evidenceTransferConfirmed: true,
  now,
});

test("Stage 0 plan is content-free and keeps Stage 1 distribution blocked", (t) => {
  const values = fixture(t);
  const plan = createStage0Plan(validOptions(values));
  assert.deepEqual(plan, {
    format: "mangai.desktop-adult-stage0-plan",
    version: 1,
    candidateId: "candidate-a1b2c3d4e5f6",
    artifactVersion: "0.1.0",
    artifactPurpose: "stage0_acceptance_only",
    scheduledStartAt: "2026-09-20T00:00:00.000Z",
    deleteBy: "2026-09-27T00:00:00.000Z",
    assistedSessionConfirmed: true,
    stopContactConfirmed: true,
    evidenceTransferConfirmed: true,
    artifactSeparatedFromStage1: true,
    stage1DistributionAuthorized: false,
  });
  const serialized = fs.readFileSync(values.outputPath, "utf8");
  assert.doesNotMatch(
    serialized,
    new RegExp(values.outputPath.replaceAll("\\", "\\\\")),
  );
});

test("Stage 0 plan refuses overwrite and repository output", (t) => {
  const values = fixture(t);
  const options = validOptions(values);
  createStage0Plan(options);
  assert.throws(() => createStage0Plan(options), /EEXIST/);
  assert.throws(
    () =>
      createStage0Plan({
        ...options,
        outputPath: path.join(values.desktopRoot, "plan.json"),
      }),
    /Git管理外/,
  );
});

test("Stage 0 plan requires a safe candidate ID and all confirmations", (t) => {
  const values = fixture(t);
  const options = validOptions(values);
  assert.throws(
    () => createStage0Plan({ ...options, candidateId: "candidate-person" }),
    /candidate ID/,
  );
  assert.throws(
    () => createStage0Plan({ ...options, stopContactConfirmed: false }),
    /3項目/,
  );
});

test("Stage 0 plan enforces future ISO timestamps and 14-day retention", (t) => {
  const values = fixture(t);
  const options = validOptions(values);
  assert.throws(
    () => createStage0Plan({ ...options, scheduledStartAt: "2026-09-20" }),
    /ISO日時/,
  );
  assert.throws(
    () =>
      createStage0Plan({
        ...options,
        scheduledStartAt: "2026-09-15T00:00:00.000Z",
      }),
    /現在以降/,
  );
  assert.throws(
    () =>
      createStage0Plan({
        ...options,
        deleteBy: "2026-10-05T00:00:00.000Z",
      }),
    /14日以内/,
  );
});
