import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditStage0RetentionProposal } from "../scripts/adult-pilot-stage0-retention-audit.mjs";
import { createStage0RetentionProposal } from "../scripts/adult-pilot-stage0-retention-proposal.mjs";

const auditScript = path.resolve(
  new URL("../scripts/adult-pilot-stage0-retention-audit.mjs", import.meta.url)
    .pathname,
);
const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const write = (target, value) => {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
};
const directorySnapshot = (root) =>
  Object.fromEntries(
    fs
      .readdirSync(root)
      .sort()
      .map((name) => [name, digest(fs.readFileSync(path.join(root, name)))]),
  );

const fixture = (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-stage0-retention-audit-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, "repository");
  const privateRoot = path.join(root, "private");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(privateRoot);
  const lifecycleAuditor = () => ({
    phase: "OPERATION_PACKAGE",
    state: "EXPIRED",
    acceptancePassed: false,
    retentionActionRequired: true,
  });
  const values = {
    repositoryRoot,
    privateRoot,
    assessmentPath: write(path.join(privateRoot, "assessment.json"), {
      candidateId: "candidate-a1b2c3d4e5f6",
    }),
    planPath: write(path.join(privateRoot, "plan.json"), { source: "plan" }),
    artifactEvidencePath: write(path.join(privateRoot, "artifact.json"), {
      source: "artifact",
    }),
    bundleEvidencePath: write(path.join(privateRoot, "bundle.json"), {
      source: "bundle",
    }),
    packagePath: write(path.join(privateRoot, "operation-package.json"), {
      candidateId: "candidate-a1b2c3d4e5f6",
      deleteBy: "2026-09-16T12:00:00.000Z",
    }),
    proposalPath: path.join(privateRoot, "retention-proposal.json"),
    now: new Date("2026-09-17T00:00:00.000Z"),
    lifecycleAuditor,
  };
  createStage0RetentionProposal({
    ...values,
    outputPath: values.proposalPath,
    confirmRetentionScopeReviewed: true,
    confirmNoRetentionHold: true,
    confirmUserContentExcluded: true,
    confirmSeparateApplyRequired: true,
  });
  return values;
};

test("Stage 0 retention audit verifies a proposal without writes", (t) => {
  const values = fixture(t);
  const before = directorySnapshot(values.privateRoot);
  assert.deepEqual(auditStage0RetentionProposal(values), {
    state: "PROPOSAL_READY",
    lifecyclePhase: "OPERATION_PACKAGE",
    evidenceCount: 5,
    deletionAuthorized: false,
  });
  assert.deepEqual(directorySnapshot(values.privateRoot), before);
});

test("Stage 0 retention audit rejects changed evidence and proposal tampering", (t) => {
  const changedEvidence = fixture(t);
  fs.appendFileSync(changedEvidence.assessmentPath, " ");
  assert.throws(
    () => auditStage0RetentionProposal(changedEvidence),
    /現在のStage 0証跡と一致しません/,
  );

  const changedProposal = fixture(t);
  const proposal = JSON.parse(
    fs.readFileSync(changedProposal.proposalPath, "utf8"),
  );
  proposal.evidence[0].contentSha256 = "9".repeat(64);
  write(changedProposal.proposalPath, proposal);
  assert.throws(
    () => auditStage0RetentionProposal(changedProposal),
    /scope digest/,
  );
});

test("Stage 0 retention audit requires the lifecycle to remain expired", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      auditStage0RetentionProposal({
        ...values,
        lifecycleAuditor: () => ({
          phase: "OPERATION_PACKAGE",
          state: "READY",
          acceptancePassed: false,
          retentionActionRequired: false,
        }),
      }),
    /現在EXPIREDではありません/,
  );
});

test("Stage 0 retention audit rejects a moved proposal", (t) => {
  const values = fixture(t);
  const movedPath = path.join(values.privateRoot, "moved-proposal.json");
  fs.renameSync(values.proposalPath, movedPath);
  assert.throws(
    () =>
      auditStage0RetentionProposal({
        ...values,
        proposalPath: movedPath,
      }),
    /保存場所が作成時と一致しません/,
  );
});

test("Stage 0 retention audit rejects concurrent source changes", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      auditStage0RetentionProposal({
        ...values,
        beforeFinalVerification: () =>
          fs.appendFileSync(values.bundleEvidencePath, " "),
      }),
    /処理中に変更/,
  );
});

test("Stage 0 retention audit CLI never exposes identities or paths", (t) => {
  const values = fixture(t);
  const result = spawnSync(
    process.execPath,
    [
      auditScript,
      "--assessment",
      values.assessmentPath,
      "--plan",
      values.planPath,
      "--artifact-evidence",
      values.artifactEvidencePath,
      "--bundle-evidence",
      values.bundleEvidencePath,
      "--package",
      values.packagePath,
      "--proposal",
      values.proposalPath,
    ],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(
    `${result.stdout}\n${result.stderr}`,
    /candidate-|operation-package\.json|assessment\.json|private|repository/i,
  );
});
