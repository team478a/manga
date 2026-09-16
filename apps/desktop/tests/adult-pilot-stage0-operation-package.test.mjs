import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createStage0OperationPackage,
  verifyStage0OperationPackage,
} from "../scripts/adult-pilot-stage0-operation-package.mjs";

const write = (root, name, value) => {
  const target = path.join(root, name);
  fs.writeFileSync(target, `${JSON.stringify(value)}\n`);
  return target;
};

const fixture = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-stage0-package-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, "repository");
  const privateRoot = path.join(root, "private");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(privateRoot);
  const candidateId = "candidate-a1b2c3d4e5f6";
  const assessmentPath = write(privateRoot, "assessment.json", {
    format: "mangai.desktop-adult-technical-monitor-assessment",
    candidateId,
    distributionAuthorized: false,
  });
  const planPath = write(privateRoot, "plan.json", {
    format: "mangai.desktop-adult-stage0-plan",
    candidateId,
    artifactVersion: "0.1.0",
    artifactPurpose: "stage0_acceptance_only",
    scheduledStartAt: "2099-01-01T00:00:00.000Z",
    deleteBy: "2099-01-08T00:00:00.000Z",
    stage1DistributionAuthorized: false,
  });
  const artifactEvidencePath = write(privateRoot, "artifact.json", {
    format: "mangai.desktop-adult-stage0-artifact-evidence",
    artifactVersion: "0.1.0",
    artifactPurpose: "stage0_acceptance_only",
    distributionAuthorized: false,
  });
  const bundleEvidencePath = write(privateRoot, "bundle-evidence.json", {
    format: "mangai.desktop-adult-pilot-bundle-evidence",
  });
  const bundlePath = write(repositoryRoot, "bundle.json", {
    format: "mangai.desktop-adult-pilot-bundle",
  });
  const approvalsPath = write(repositoryRoot, "approvals.json", {
    format: "mangai.desktop-adult-pilot-release-approvals",
  });
  return {
    repositoryRoot,
    assessmentPath,
    planPath,
    artifactEvidencePath,
    bundleEvidencePath,
    bundlePath,
    approvalsPath,
    outputPath: path.join(privateRoot, "operation-package.json"),
    packagePath: path.join(privateRoot, "operation-package.json"),
    readinessCheck: () => {},
    now: new Date("2026-09-16T09:00:00.000Z"),
  };
};

test("Stage 0 operation package fixes six content-free source digests", (t) => {
  const values = fixture(t);
  const operationPackage = createStage0OperationPackage(values);
  assert.equal(operationPackage.candidateId, "candidate-a1b2c3d4e5f6");
  assert.equal(operationPackage.stage0Ready, true);
  assert.equal(operationPackage.stage1DistributionAuthorized, false);
  assert.deepEqual(Object.keys(operationPackage.sources).sort(), [
    "artifactEvidenceSha256",
    "bundleEvidenceSha256",
    "candidateAssessmentSha256",
    "fixedBundleManifestSha256",
    "ownerApprovalsSha256",
    "stage0PlanSha256",
  ]);
  assert.ok(
    Object.values(operationPackage.sources).every((value) =>
      /^[a-f0-9]{64}$/.test(value),
    ),
  );
  const serialized = fs.readFileSync(values.outputPath, "utf8");
  assert.doesNotMatch(serialized, /private|repository|assessment\.json/i);
});

test("Stage 0 operation package verifies the unchanged source set", (t) => {
  const values = fixture(t);
  createStage0OperationPackage(values);
  const verified = verifyStage0OperationPackage(values);
  assert.equal(verified.artifactVersion, "0.1.0");
});

test("Stage 0 operation package detects source tampering", (t) => {
  const values = fixture(t);
  createStage0OperationPackage(values);
  fs.appendFileSync(values.bundleEvidencePath, " ");
  assert.throws(
    () => verifyStage0OperationPackage(values),
    /現在のStage 0 sourceが一致しません/,
  );
});

test("Stage 0 operation package rejects mismatched candidate and version", (t) => {
  const values = fixture(t);
  const plan = JSON.parse(fs.readFileSync(values.planPath, "utf8"));
  plan.candidateId = "candidate-000000000000";
  fs.writeFileSync(values.planPath, JSON.stringify(plan));
  assert.throws(
    () => createStage0OperationPackage(values),
    /candidate IDが一致しません/,
  );

  const values2 = fixture(t);
  const artifact = JSON.parse(
    fs.readFileSync(values2.artifactEvidencePath, "utf8"),
  );
  artifact.artifactVersion = "0.2.0";
  fs.writeFileSync(values2.artifactEvidencePath, JSON.stringify(artifact));
  assert.throws(
    () => createStage0OperationPackage(values2),
    /artifactまたは配布境界/,
  );
});

test("Stage 0 operation package requires current strict readiness", (t) => {
  const values = fixture(t);
  values.readinessCheck = () => {
    throw new Error("Stage 0 readiness strictが成功していません。");
  };
  assert.throws(() => createStage0OperationPackage(values), /readiness strict/);
  assert.equal(fs.existsSync(values.outputPath), false);
});

test("Stage 0 operation package only reads and writes private absolute paths", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      createStage0OperationPackage({ ...values, outputPath: "package.json" }),
    /絶対path/,
  );
  assert.throws(
    () =>
      createStage0OperationPackage({
        ...values,
        outputPath: path.join(values.repositoryRoot, "package.json"),
      }),
    /Git管理外/,
  );
  const digestBefore = crypto
    .createHash("sha256")
    .update(fs.readFileSync(values.assessmentPath))
    .digest("hex");
  createStage0OperationPackage(values);
  assert.throws(() => createStage0OperationPackage(values), /EEXIST/);
  const digestAfter = crypto
    .createHash("sha256")
    .update(fs.readFileSync(values.assessmentPath))
    .digest("hex");
  assert.equal(digestAfter, digestBefore);
});
