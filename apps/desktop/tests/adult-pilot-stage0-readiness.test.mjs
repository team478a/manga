import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = path.resolve(
  import.meta.dirname,
  "../scripts/check-adult-pilot-stage0-readiness.mjs",
);
const write = (root, name, value) => {
  const target = path.join(root, name);
  fs.writeFileSync(target, JSON.stringify(value));
  return target;
};
const timestamp = "2099-01-01T00:00:00.000Z";
const candidateId = "candidate-a1b2c3d4e5f6";
const fixtures = (root) => {
  const plan = {
    format: "mangai.desktop-adult-stage0-plan",
    version: 1,
    candidateId,
    artifactVersion: "0.1.0",
    artifactPurpose: "stage0_acceptance_only",
    scheduledStartAt: timestamp,
    deleteBy: "2099-01-08T00:00:00.000Z",
    assistedSessionConfirmed: true,
    stopContactConfirmed: true,
    evidenceTransferConfirmed: true,
    artifactSeparatedFromStage1: true,
    stage1DistributionAuthorized: false,
  };
  const assessment = {
    format: "mangai.desktop-adult-technical-monitor-assessment",
    version: 1,
    candidateId,
    evaluatedAt: timestamp,
    eligible: true,
    environment: {
      windows: "windows_11",
      gpuVendor: "nvidia",
      vramBand: "12gb",
      ramBand: "32gb_or_more",
      freeDiskBand: "50gb_or_more",
    },
    failedChecks: [],
    warnings: [],
    distributionAuthorized: false,
    nextStep: "signed_acceptance_artifact_and_release_readiness_required",
  };
  const artifactEvidence = {
    format: "mangai.desktop-adult-stage0-artifact-evidence",
    version: 1,
    generatedAt: timestamp,
    artifactVersion: "0.1.0",
    artifactPurpose: "stage0_acceptance_only",
    distributionAuthorized: false,
    signatures: {
      installerStatus: "Valid",
      productExecutableStatus: "Valid",
      sameSigner: true,
    },
    artifacts: {
      installerSha256: "1".repeat(64),
      blockmapSha256: "2".repeat(64),
      updateMetadataSha256: "3".repeat(64),
      sbomSha256: "4".repeat(64),
      checksumsSha256: "5".repeat(64),
      productExecutableSha256: "6".repeat(64),
    },
  };
  const fixed = { status: "fixed" };
  const bundle = {
    format: "mangai.desktop-adult-pilot-bundle",
    version: 1,
    comfyui: fixed,
    workflows: Array.from({ length: 4 }, () => ({ ...fixed })),
    models: Array.from({ length: 3 }, () => ({ ...fixed })),
  };
  const approvals = {
    format: "mangai.desktop-adult-pilot-release-approvals",
    version: 1,
    pilotStartApproved: true,
    manualVersionStopConstraintAccepted: true,
    approvedAt: timestamp,
  };
  return {
    plan,
    assessment,
    env: {
      MANGAI_ADULT_PILOT_STAGE0_PLAN_PATH: write(root, "plan.json", plan),
      MANGAI_ADULT_PILOT_STAGE0_ASSESSMENT_PATH: write(
        root,
        "assessment.json",
        assessment,
      ),
      MANGAI_ADULT_PILOT_STAGE0_ARTIFACT_EVIDENCE_PATH: write(
        root,
        "artifact-evidence.json",
        artifactEvidence,
      ),
      MANGAI_ADULT_PILOT_BUNDLE_PATH: write(root, "bundle.json", bundle),
      MANGAI_ADULT_PILOT_RELEASE_APPROVALS_PATH: write(
        root,
        "approvals.json",
        approvals,
      ),
      MANGAI_ADULT_PILOT_DESKTOP_PACKAGE_PATH: write(root, "package.json", {
        version: "0.1.0",
      }),
    },
  };
};
const run = (env, ...args) =>
  spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

test("Adult Stage 0 gate passes only the acceptance stage and keeps Stage 1 closed", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-stage0-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { env } = fixtures(root);
  const result = run(env, "--strict");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stage0Ready=true/);
  assert.match(result.stdout, /stage1DistributionAuthorized=false/);
  assert.match(
    result.stdout,
    /hardware_12gb_four_modes: COLLECT_DURING_STAGE0/,
  );
});

test("Adult Stage 0 gate blocks missing candidate, signing, fixed bundle, and session plan", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-stage0-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { env, plan } = fixtures(root);
  delete env.MANGAI_ADULT_PILOT_STAGE0_ASSESSMENT_PATH;
  delete env.MANGAI_ADULT_PILOT_STAGE0_ARTIFACT_EVIDENCE_PATH;
  const bundle = JSON.parse(
    fs.readFileSync(env.MANGAI_ADULT_PILOT_BUNDLE_PATH),
  );
  bundle.comfyui.status = "pending";
  env.MANGAI_ADULT_PILOT_BUNDLE_PATH = write(
    root,
    "pending-bundle.json",
    bundle,
  );
  plan.assistedSessionConfirmed = false;
  env.MANGAI_ADULT_PILOT_STAGE0_PLAN_PATH = write(
    root,
    "blocked-plan.json",
    plan,
  );
  const result = run(env, "--strict");
  assert.equal(result.status, 1);
  for (const id of [
    "candidate_assessment",
    "signed_acceptance_artifact",
    "fixed_bundle",
    "assisted_session_and_stop_plan",
  ])
    assert.match(result.stdout, new RegExp(`${id}: BLOCKED`));
  assert.match(result.stdout, /stage0Ready=false/);
});

test("Adult Stage 0 gate rejects a candidate mismatch", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-stage0-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { env, assessment } = fixtures(root);
  assessment.candidateId = "candidate-000000000001";
  env.MANGAI_ADULT_PILOT_STAGE0_ASSESSMENT_PATH = write(
    root,
    "other-assessment.json",
    assessment,
  );
  const result = run(env, "--strict");
  assert.equal(result.status, 1);
  assert.match(result.stdout, /candidate_assessment: BLOCKED/);
});

test("Adult Stage 0 plan rejects private data and unbounded retention", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-stage0-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { env, plan } = fixtures(root);
  plan.email = "person@example.test";
  env.MANGAI_ADULT_PILOT_STAGE0_PLAN_PATH = write(
    root,
    "private-plan.json",
    plan,
  );
  let result = run(env);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /email is prohibited/);

  delete plan.email;
  plan.deleteBy = "2099-02-01T00:00:00.000Z";
  env.MANGAI_ADULT_PILOT_STAGE0_PLAN_PATH = write(root, "long-plan.json", plan);
  result = run(env);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /within 14 days/);
});

test("Adult Stage 0 gate rejects extra assessment fields and inconsistent hardware", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-stage0-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { env, assessment } = fixtures(root);
  assessment.freeText = "anything";
  env.MANGAI_ADULT_PILOT_STAGE0_ASSESSMENT_PATH = write(
    root,
    "extra-assessment.json",
    assessment,
  );
  let result = run(env);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsupported fields: freeText/);

  delete assessment.freeText;
  assessment.environment.vramBand = "under_12gb";
  env.MANGAI_ADULT_PILOT_STAGE0_ASSESSMENT_PATH = write(
    root,
    "inconsistent-assessment.json",
    assessment,
  );
  result = run(env, "--strict");
  assert.equal(result.status, 1);
  assert.match(result.stdout, /candidate_assessment: BLOCKED/);
});

test("Adult Stage 0 gate rejects forged or path-bearing artifact evidence", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-stage0-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { env } = fixtures(root);
  const evidence = JSON.parse(
    fs.readFileSync(env.MANGAI_ADULT_PILOT_STAGE0_ARTIFACT_EVIDENCE_PATH),
  );
  evidence.absolutePath = "C:\\private\\MANGAI.exe";
  env.MANGAI_ADULT_PILOT_STAGE0_ARTIFACT_EVIDENCE_PATH = write(
    root,
    "path-evidence.json",
    evidence,
  );
  let result = run(env, "--strict");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /absolutePath is prohibited/);

  delete evidence.absolutePath;
  evidence.signatures.sameSigner = false;
  env.MANGAI_ADULT_PILOT_STAGE0_ARTIFACT_EVIDENCE_PATH = write(
    root,
    "forged-evidence.json",
    evidence,
  );
  result = run(env, "--strict");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /format or verification is unsupported/);
});
