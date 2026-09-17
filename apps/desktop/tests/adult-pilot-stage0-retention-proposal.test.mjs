import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createStage0RetentionProposal,
  retentionScopeSha256,
  validateStage0RetentionProposal,
} from "../scripts/adult-pilot-stage0-retention-proposal.mjs";

const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const write = (target, value) => {
  fs.writeFileSync(
    target,
    typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`,
  );
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
    path.join(os.tmpdir(), "mangai-stage0-retention-proposal-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, "repository");
  const privateRoot = path.join(root, "private");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(privateRoot);
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
    outputPath: path.join(privateRoot, "retention-proposal.json"),
    now: new Date("2026-09-17T00:00:00.000Z"),
    lifecycleAuditor: () => ({
      phase: "OPERATION_PACKAGE",
      state: "EXPIRED",
      acceptancePassed: false,
      retentionActionRequired: true,
    }),
    confirmRetentionScopeReviewed: true,
    confirmNoRetentionHold: true,
    confirmUserContentExcluded: true,
    confirmSeparateApplyRequired: true,
  };
  return values;
};

const addCompletedEvidence = (values) => {
  values.authorizationPath = write(
    path.join(values.privateRoot, "authorization.json"),
    { source: "authorization" },
  );
  write(`${values.packagePath}.stage0-start-consumed.json`, {
    source: "receipt",
  });
  values.hardwareEvidencePath = write(
    path.join(values.privateRoot, "hardware.json"),
    { source: "hardware" },
  );
  write(`${values.packagePath}.stage0-completion.json`, {
    source: "completion",
  });
  values.lifecycleAuditor = () => ({
    phase: "COMPLETION",
    state: "EXPIRED",
    acceptancePassed: true,
    retentionActionRequired: true,
  });
};

test("Stage 0 retention proposal fixes an expired content-free scope", (t) => {
  const values = fixture(t);
  const before = directorySnapshot(values.privateRoot);
  const result = createStage0RetentionProposal(values);
  assert.equal(result.proposal.lifecycleState, "EXPIRED");
  assert.equal(result.proposal.deletionAuthorized, false);
  assert.deepEqual(result.proposal.retentionChecks, {
    scopeReviewed: true,
    noRetentionHold: true,
    userContentExcluded: true,
    separateApplyRequired: true,
  });
  assert.equal(result.proposal.evidence.length, 5);
  assert.deepEqual(
    result.proposal.evidence.map((item) => item.role),
    [
      "candidate_assessment",
      "stage0_plan",
      "signed_artifact_evidence",
      "fixed_bundle_evidence",
      "operation_package",
    ],
  );
  const serialized = fs.readFileSync(result.outputPath, "utf8");
  assert.doesNotMatch(serialized, /candidate-|assessment\.json|private/i);
  const after = directorySnapshot(values.privateRoot);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(after).filter(
        ([name]) => name !== "retention-proposal.json",
      ),
    ),
    before,
  );
});

test("Stage 0 retention proposal binds a completed nine-file lifecycle", (t) => {
  const values = fixture(t);
  addCompletedEvidence(values);
  const { proposal } = createStage0RetentionProposal(values);
  assert.equal(proposal.lifecyclePhase, "COMPLETION");
  assert.equal(proposal.acceptancePassed, true);
  assert.equal(proposal.evidence.length, 9);
  assert.deepEqual(
    proposal.evidence.map((item) => item.role),
    [
      "candidate_assessment",
      "stage0_plan",
      "signed_artifact_evidence",
      "fixed_bundle_evidence",
      "operation_package",
      "start_authorization",
      "start_consumed_receipt",
      "hardware_evidence",
      "completion_evidence",
    ],
  );
});

test("Stage 0 retention proposal requires expiry and all confirmations", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      createStage0RetentionProposal({
        ...values,
        confirmNoRetentionHold: false,
      }),
    /明示確認/,
  );
  assert.throws(
    () =>
      createStage0RetentionProposal({
        ...values,
        lifecycleAuditor: () => ({
          phase: "OPERATION_PACKAGE",
          state: "READY",
          acceptancePassed: false,
          retentionActionRequired: false,
        }),
      }),
    /削除期限へ到達/,
  );
  assert.throws(
    () =>
      createStage0RetentionProposal({
        ...values,
        now: new Date("2026-09-16T11:59:59.999Z"),
      }),
    /削除期限へ到達していません/,
  );
});

test("Stage 0 retention proposal rejects unsafe, duplicate, and overwritten output", (t) => {
  const duplicate = fixture(t);
  assert.throws(
    () =>
      createStage0RetentionProposal({
        ...duplicate,
        outputPath: duplicate.assessmentPath,
      }),
    /重複/,
  );

  const repository = fixture(t);
  assert.throws(
    () =>
      createStage0RetentionProposal({
        ...repository,
        outputPath: path.join(repository.repositoryRoot, "proposal.json"),
      }),
    /Git管理外/,
  );

  const overwrite = fixture(t);
  createStage0RetentionProposal(overwrite);
  assert.throws(() => createStage0RetentionProposal(overwrite), /EEXIST/);
});

test("Stage 0 retention proposal rejects evidence changed during creation", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      createStage0RetentionProposal({
        ...values,
        beforeWrite: () => fs.appendFileSync(values.planPath, " "),
      }),
    /処理中に変更/,
  );
  assert.equal(fs.existsSync(values.outputPath), false);
});

test("Stage 0 retention proposal schema rejects phase and private-data tampering", (t) => {
  const values = fixture(t);
  const { proposal } = createStage0RetentionProposal(values);
  assert.throws(
    () =>
      validateStage0RetentionProposal({
        ...proposal,
        absolutePath: "C:\\private\\evidence.json",
      }),
    /保存禁止|field構成/,
  );
  const invalidPhase = structuredClone(proposal);
  invalidPhase.lifecyclePhase = "COMPLETION";
  invalidPhase.acceptancePassed = true;
  invalidPhase.retentionScopeSha256 = retentionScopeSha256({
    deleteBy: invalidPhase.deleteBy,
    lifecyclePhase: invalidPhase.lifecyclePhase,
    acceptancePassed: invalidPhase.acceptancePassed,
    evidence: invalidPhase.evidence,
  });
  assert.throws(
    () => validateStage0RetentionProposal(invalidPhase),
    /phaseと証跡scope/,
  );
});
