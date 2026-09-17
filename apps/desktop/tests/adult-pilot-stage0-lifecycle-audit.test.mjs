import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createStage0CompletionEvidence } from "../scripts/adult-pilot-stage0-completion-evidence.mjs";
import { auditAdultPilotStage0Lifecycle } from "../scripts/adult-pilot-stage0-lifecycle-audit.mjs";
import {
  consumeStage0StartAuthorization,
  createStage0StartAuthorization,
} from "../scripts/adult-pilot-stage0-start-authorization.mjs";

const auditScript = path.resolve(
  new URL("../scripts/adult-pilot-stage0-lifecycle-audit.mjs", import.meta.url)
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

const hardwareEvidence = () => ({
  format: "mangai.phase5-hardware-evidence",
  version: 1,
  profile: "vram_12gb",
  hardware: {
    totalRamBytes: 32 * 1024 ** 3,
    gpuName: "Acceptance GPU",
    dedicatedVramMb: 12 * 1024,
  },
  checkedAt: "2026-09-16T11:00:00.000Z",
  projectIdSha256: "a".repeat(64),
  operations: [
    "text_to_image",
    "image_to_image",
    "controlnet",
    "inpainting",
  ].map((operation, index) => ({
    operation,
    result: "passed",
    outputSha256: String(index + 1).repeat(64),
    completedAt: `2026-09-16T10:${String(index + 10).padStart(2, "0")}:00.000Z`,
  })),
  export: {
    pdfSha256: "b".repeat(64),
    salesPackageSha256: "c".repeat(64),
    createdAt: "2026-09-16T10:45:00.000Z",
  },
});

const fixture = (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-stage0-lifecycle-audit-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, "repository");
  const privateRoot = path.join(root, "private");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(privateRoot);
  const operationPackage = {
    format: "mangai.desktop-adult-stage0-operation-package",
    version: 1,
    createdAt: "2026-09-16T09:00:00.000Z",
    candidateId: "candidate-a1b2c3d4e5f6",
    artifactVersion: "0.1.0",
    artifactPurpose: "stage0_acceptance_only",
    scheduledStartAt: "2026-09-16T09:30:00.000Z",
    deleteBy: "2026-09-20T00:00:00.000Z",
    sources: {
      candidateAssessmentSha256: "a".repeat(64),
      stage0PlanSha256: "b".repeat(64),
      artifactEvidenceSha256: "c".repeat(64),
      bundleEvidenceSha256: "d".repeat(64),
      fixedBundleManifestSha256: "e".repeat(64),
      ownerApprovalsSha256: "f".repeat(64),
    },
    stage0Ready: true,
    stage1DistributionAuthorized: false,
  };
  const values = {
    repositoryRoot,
    privateRoot,
    assessmentPath: write(path.join(privateRoot, "assessment.json"), {
      source: "assessment",
    }),
    planPath: write(path.join(privateRoot, "plan.json"), { source: "plan" }),
    artifactEvidencePath: write(path.join(privateRoot, "artifact.json"), {
      source: "artifact",
    }),
    bundleEvidencePath: write(path.join(privateRoot, "bundle.json"), {
      source: "bundle",
    }),
    packagePath: write(
      path.join(privateRoot, "operation-package.json"),
      operationPackage,
    ),
    authorizationPath: path.join(privateRoot, "start-authorization.json"),
    hardwareEvidencePath: path.join(privateRoot, "hardware-evidence.json"),
    operationPackageVerifier: () => operationPackage,
    now: new Date("2026-09-16T10:00:00.000Z"),
  };
  return values;
};

const authorize = (values) =>
  createStage0StartAuthorization({
    ...values,
    outputPath: values.authorizationPath,
    confirmOwnerApproved: true,
    confirmAcceptanceOnly: true,
    confirmManualStop: true,
    confirmStage1Blocked: true,
  });

const consume = (values) =>
  consumeStage0StartAuthorization({
    ...values,
    now: new Date("2026-09-16T10:01:00.000Z"),
  });

const complete = (values) => {
  write(values.hardwareEvidencePath, hardwareEvidence());
  return createStage0CompletionEvidence({
    ...values,
    now: new Date("2026-09-16T11:05:00.000Z"),
  });
};

test("Stage 0 lifecycle audit reports a verified package without writes", (t) => {
  const values = fixture(t);
  const before = directorySnapshot(values.privateRoot);
  assert.deepEqual(
    auditAdultPilotStage0Lifecycle({
      ...values,
      authorizationPath: undefined,
      hardwareEvidencePath: undefined,
    }),
    {
      phase: "OPERATION_PACKAGE",
      state: "READY",
      acceptancePassed: false,
      retentionActionRequired: false,
    },
  );
  assert.deepEqual(directorySnapshot(values.privateRoot), before);
});

test("Stage 0 lifecycle audit reports prepared and in-progress sessions", (t) => {
  const prepared = fixture(t);
  authorize(prepared);
  assert.deepEqual(
    auditAdultPilotStage0Lifecycle({
      ...prepared,
      hardwareEvidencePath: undefined,
    }),
    {
      phase: "START_AUTHORIZATION",
      state: "PREPARED",
      acceptancePassed: false,
      retentionActionRequired: false,
    },
  );

  const inProgress = fixture(t);
  authorize(inProgress);
  consume(inProgress);
  assert.deepEqual(
    auditAdultPilotStage0Lifecycle({
      ...inProgress,
      hardwareEvidencePath: undefined,
    }),
    {
      phase: "ACCEPTANCE",
      state: "IN_PROGRESS",
      acceptancePassed: false,
      retentionActionRequired: false,
    },
  );
});

test("Stage 0 lifecycle audit links completion to the consumed session", (t) => {
  const values = fixture(t);
  authorize(values);
  consume(values);
  complete(values);
  const before = directorySnapshot(values.privateRoot);
  assert.deepEqual(auditAdultPilotStage0Lifecycle(values), {
    phase: "COMPLETION",
    state: "COMPLETED",
    acceptancePassed: true,
    retentionActionRequired: false,
  });
  assert.deepEqual(directorySnapshot(values.privateRoot), before);
});

test("Stage 0 lifecycle audit reports expired evidence without weakening validation", (t) => {
  const values = fixture(t);
  authorize(values);
  consume(values);
  complete(values);
  assert.deepEqual(
    auditAdultPilotStage0Lifecycle({
      ...values,
      now: new Date("2026-09-20T00:00:00.000Z"),
    }),
    {
      phase: "COMPLETION",
      state: "EXPIRED",
      acceptancePassed: true,
      retentionActionRequired: true,
    },
  );
});

test("Stage 0 lifecycle audit rejects dangling or tampered evidence", (t) => {
  const dangling = fixture(t);
  write(`${dangling.packagePath}.stage0-start-consumed.json`, {
    dangling: true,
  });
  assert.throws(
    () =>
      auditAdultPilotStage0Lifecycle({
        ...dangling,
        authorizationPath: undefined,
        hardwareEvidencePath: undefined,
      }),
    /前工程なし/,
  );

  const tampered = fixture(t);
  authorize(tampered);
  consume(tampered);
  const { outputPath } = complete(tampered);
  const completion = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  completion.startReceiptSha256 = "9".repeat(64);
  write(outputPath, completion);
  assert.throws(
    () => auditAdultPilotStage0Lifecycle(tampered),
    /開始済みsessionと一致しません/,
  );
});

test("Stage 0 lifecycle audit validates collected hardware before completion", (t) => {
  const values = fixture(t);
  authorize(values);
  consume(values);
  const evidence = hardwareEvidence();
  evidence.operations[0].completedAt = "2026-09-16T09:59:59.999Z";
  write(values.hardwareEvidencePath, evidence);
  assert.throws(() => auditAdultPilotStage0Lifecycle(values), /開始消費後/);
});

test("Stage 0 lifecycle audit rejects concurrent evidence changes", (t) => {
  const values = fixture(t);
  assert.throws(
    () =>
      auditAdultPilotStage0Lifecycle({
        ...values,
        authorizationPath: undefined,
        hardwareEvidencePath: undefined,
        beforeFinalVerification: () =>
          fs.appendFileSync(values.assessmentPath, " "),
      }),
    /監査中に変更/,
  );
});

test("Stage 0 lifecycle audit CLI does not expose identities or paths", (t) => {
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
    ],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(
    `${result.stdout}\n${result.stderr}`,
    /candidate-|operation-package\.json|assessment\.json|private|repository/i,
  );
});
