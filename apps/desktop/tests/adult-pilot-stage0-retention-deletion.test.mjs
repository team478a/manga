import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createStage0RetentionAuthorization } from "../scripts/adult-pilot-stage0-retention-authorization.mjs";
import { applyStage0RetentionDeletion } from "../scripts/adult-pilot-stage0-retention-apply.mjs";
import { auditStage0RetentionDeletion } from "../scripts/adult-pilot-stage0-retention-deletion-audit.mjs";
import { auditStage0RetentionDeletionLifecycle } from "../scripts/adult-pilot-stage0-retention-deletion-lifecycle-audit.mjs";
import { createStage0RetentionProposal } from "../scripts/adult-pilot-stage0-retention-proposal.mjs";

const scriptDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../scripts",
);
const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const write = (target, value) => {
  fs.writeFileSync(
    target,
    typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`,
  );
  return target;
};
const directorySnapshot = (root) => {
  const result = {};
  const visit = (directory, prefix = "") => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = path.join(prefix, entry.name);
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target, relative);
      else result[relative] = digest(fs.readFileSync(target));
    }
  };
  visit(root);
  return result;
};

const expiredLifecycle =
  (phase = "OPERATION_PACKAGE") =>
  () => ({
    phase,
    state: "EXPIRED",
    acceptancePassed: phase === "COMPLETION",
    retentionActionRequired: true,
  });

const fixture = (t, { completed = false } = {}) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "mangai-stage0-retention-deletion-"),
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
    proposalPath: path.join(privateRoot, "retention-proposal.json"),
    deletionAuthorizationPath: path.join(
      privateRoot,
      "retention-deletion-authorization.json",
    ),
    quarantineDirectory: path.join(privateRoot, "retention-recovery"),
    lifecycleAuditor: expiredLifecycle(),
  };
  if (completed) {
    values.authorizationPath = write(
      path.join(privateRoot, "start-authorization.json"),
      { source: "start-authorization" },
    );
    write(`${values.packagePath}.stage0-start-consumed.json`, {
      source: "start-consumed",
    });
    values.hardwareEvidencePath = write(
      path.join(privateRoot, "hardware.json"),
      { source: "hardware" },
    );
    write(`${values.packagePath}.stage0-completion.json`, {
      source: "completion",
    });
    values.lifecycleAuditor = expiredLifecycle("COMPLETION");
  }
  createStage0RetentionProposal({
    ...values,
    outputPath: values.proposalPath,
    now: new Date("2026-09-17T00:00:00.000Z"),
    confirmRetentionScopeReviewed: true,
    confirmNoRetentionHold: true,
    confirmUserContentExcluded: true,
    confirmSeparateApplyRequired: true,
  });
  const sourcePaths = [
    values.assessmentPath,
    values.planPath,
    values.artifactEvidencePath,
    values.bundleEvidencePath,
    values.packagePath,
    ...(completed
      ? [
          values.authorizationPath,
          `${values.packagePath}.stage0-start-consumed.json`,
          values.hardwareEvidencePath,
          `${values.packagePath}.stage0-completion.json`,
        ]
      : []),
  ];
  const sourceBytes = new Map(
    sourcePaths.map((target) => [target, fs.readFileSync(target)]),
  );
  const authorizationOptions = {
    ...values,
    outputPath: values.deletionAuthorizationPath,
    expiresAt: "2026-09-17T01:01:00.000Z",
    now: new Date("2026-09-17T00:01:00.000Z"),
    confirmProposalReviewed: true,
    confirmExactEvidenceScopeApproved: true,
    confirmNoRetentionHold: true,
    confirmUserContentExcluded: true,
    confirmStagedRecoveryUnderstood: true,
  };
  const applyOptions = {
    ...values,
    now: new Date("2026-09-17T00:02:00.000Z"),
    confirmAuthorizationReviewed: true,
    confirmQuarantineRecovery: true,
    confirmExactEvidenceDeletion: true,
    confirmFinalQuarantinePurge: true,
  };
  return {
    ...values,
    sourcePaths,
    sourceBytes,
    authorizationOptions,
    applyOptions,
    receiptPath: `${values.deletionAuthorizationPath}.deleted.json`,
    deleteIntentPath: `${values.deletionAuthorizationPath}.delete-intent.json`,
    purgeIntentPath: `${values.deletionAuthorizationPath}.purge-intent.json`,
    manifestPath: path.join(
      values.quarantineDirectory,
      "retention-quarantine-manifest.json",
    ),
  };
};

const authorize = (values) =>
  createStage0RetentionAuthorization(values.authorizationOptions);

test("retention deletion authorization binds the exact proposal without changing evidence", (t) => {
  const values = fixture(t);
  const before = Object.fromEntries(
    values.sourcePaths.map((target) => [
      target,
      digest(fs.readFileSync(target)),
    ]),
  );
  const { authorization } = authorize(values);
  assert.equal(authorization.deletionAuthorized, true);
  assert.equal(authorization.evidenceCount, 5);
  assert.equal(authorization.stage1DistributionAuthorized, false);
  assert.equal(fs.existsSync(values.quarantineDirectory), false);
  assert.deepEqual(
    Object.fromEntries(
      values.sourcePaths.map((target) => [
        target,
        digest(fs.readFileSync(target)),
      ]),
    ),
    before,
  );
  assert.doesNotMatch(
    fs.readFileSync(values.deletionAuthorizationPath, "utf8"),
    /candidate-|assessment\.json|private/i,
  );
});

test("retention deletion authorization requires confirmations, private paths, and a 24-hour lifetime", (t) => {
  const missingConfirmation = fixture(t);
  assert.throws(
    () =>
      createStage0RetentionAuthorization({
        ...missingConfirmation.authorizationOptions,
        confirmNoRetentionHold: false,
      }),
    /明示確認/,
  );

  const longLifetime = fixture(t);
  assert.throws(
    () =>
      createStage0RetentionAuthorization({
        ...longLifetime.authorizationOptions,
        expiresAt: "2026-09-18T00:01:00.001Z",
      }),
    /proposalと一致/,
  );

  const unsafe = fixture(t);
  assert.throws(
    () =>
      createStage0RetentionAuthorization({
        ...unsafe.authorizationOptions,
        outputPath: path.join(unsafe.repositoryRoot, "authorization.json"),
      }),
    /Git管理外/,
  );
});

test("retention deletion stages, purges, and records the exact five-file scope", (t) => {
  const values = fixture(t);
  authorize(values);
  const result = applyStage0RetentionDeletion(values.applyOptions);
  assert.equal(result.recovered, false);
  assert.equal(result.evidenceCount, 5);
  for (const target of values.sourcePaths)
    assert.equal(fs.existsSync(target), false);
  assert.deepEqual(fs.readdirSync(values.quarantineDirectory), [
    "retention-quarantine-manifest.json",
  ]);
  for (const target of [
    values.manifestPath,
    values.deleteIntentPath,
    values.purgeIntentPath,
    values.receiptPath,
  ])
    assert.equal(fs.existsSync(target), true);
  const receipt = JSON.parse(fs.readFileSync(values.receiptPath, "utf8"));
  assert.equal(receipt.result, "DELETED");
  assert.equal(receipt.recoveredAfterInterruption, false);
  assert.doesNotMatch(
    [values.deleteIntentPath, values.purgeIntentPath, values.receiptPath]
      .map((target) => fs.readFileSync(target, "utf8"))
      .join("\n"),
    /candidate-|assessment\.json|private/i,
  );
});

test("retention deletion supports a completed nine-file lifecycle", (t) => {
  const values = fixture(t, { completed: true });
  authorize(values);
  const result = applyStage0RetentionDeletion(values.applyOptions);
  assert.equal(result.evidenceCount, 9);
  for (const target of values.sourcePaths)
    assert.equal(fs.existsSync(target), false);
});

test("retention deletion requires apply confirmations and an unexpired authorization", (t) => {
  const confirmations = fixture(t);
  authorize(confirmations);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...confirmations.applyOptions,
        confirmFinalQuarantinePurge: false,
      }),
    /明示確認/,
  );
  for (const target of confirmations.sourcePaths)
    assert.deepEqual(
      fs.readFileSync(target),
      confirmations.sourceBytes.get(target),
    );

  const expired = fixture(t);
  authorize(expired);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...expired.applyOptions,
        now: new Date("2026-09-17T01:01:00.001Z"),
      }),
    /proposalと一致/,
  );
});

test("retention deletion rejects changed evidence and newly added out-of-scope evidence", (t) => {
  const changed = fixture(t);
  authorize(changed);
  fs.appendFileSync(changed.planPath, " ");
  assert.throws(
    () => applyStage0RetentionDeletion(changed.applyOptions),
    /proposal|変更/,
  );

  const outside = fixture(t);
  authorize(outside);
  write(`${outside.packagePath}.stage0-start-consumed.json`, {
    unexpected: true,
  });
  assert.throws(
    () => applyStage0RetentionDeletion(outside.applyOptions),
    /対象外証跡/,
  );
});

test("retention deletion resumes after an original was quarantined", (t) => {
  const values = fixture(t);
  authorize(values);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...values.applyOptions,
        afterOriginalRemoval: ({ index }) => {
          if (index === 0) throw new Error("simulated staging interruption");
        },
      }),
    /simulated staging interruption/,
  );
  assert.equal(fs.existsSync(values.sourcePaths[0]), false);
  assert.equal(fs.existsSync(values.receiptPath), false);
  const result = applyStage0RetentionDeletion({
    ...values.applyOptions,
    now: new Date("2026-09-17T00:03:00.000Z"),
  });
  assert.equal(result.recovered, true);
  assert.equal(result.receipt.recoveredAfterInterruption, true);
});

test("retention deletion resumes after purge intent and partial quarantine purge", (t) => {
  const afterIntent = fixture(t);
  authorize(afterIntent);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...afterIntent.applyOptions,
        afterPurgeIntent: () => {
          throw new Error("simulated purge-intent interruption");
        },
      }),
    /simulated purge-intent interruption/,
  );
  assert.equal(
    applyStage0RetentionDeletion({
      ...afterIntent.applyOptions,
      now: new Date("2026-09-17T00:03:00.000Z"),
    }).recovered,
    true,
  );

  const partialPurge = fixture(t);
  authorize(partialPurge);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...partialPurge.applyOptions,
        afterQuarantinePurge: ({ index }) => {
          if (index === 0) throw new Error("simulated purge interruption");
        },
      }),
    /simulated purge interruption/,
  );
  const recovered = applyStage0RetentionDeletion({
    ...partialPurge.applyOptions,
    now: new Date("2026-09-17T00:03:00.000Z"),
  });
  assert.equal(recovered.recovered, true);
});

test("retention deletion fails closed when both original and recovery copy are lost", (t) => {
  const values = fixture(t);
  authorize(values);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...values.applyOptions,
        afterOriginalRemoval: ({ index }) => {
          if (index === 0) throw new Error("stop");
        },
      }),
    /stop/,
  );
  const recoveryPayload = fs
    .readdirSync(values.quarantineDirectory)
    .find((name) => name.endsWith(".evidence"));
  fs.unlinkSync(path.join(values.quarantineDirectory, recoveryPayload));
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...values.applyOptions,
        now: new Date("2026-09-17T00:03:00.000Z"),
      }),
    /両方から証跡が失われています/,
  );
});

test("retention deletion detects control-file changes before the next removal", (t) => {
  const values = fixture(t);
  authorize(values);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...values.applyOptions,
        afterOriginalRemoval: ({ index }) => {
          if (index === 0) fs.appendFileSync(values.proposalPath, " ");
        },
      }),
    /control fileが処理中に変更/,
  );
  assert.equal(fs.existsSync(values.sourcePaths[1]), true);
});

test("retention deletion does not remove an original after its recovery copy changes", (t) => {
  const values = fixture(t);
  authorize(values);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...values.applyOptions,
        beforeOriginalRemoval: ({ index }) => {
          if (index !== 0) return;
          const recoveryPayload = fs
            .readdirSync(values.quarantineDirectory)
            .find((name) => name.endsWith(".evidence"));
          fs.appendFileSync(
            path.join(values.quarantineDirectory, recoveryPayload),
            " ",
          );
        },
      }),
    /回復領域証跡が原本削除直前に変更/,
  );
  assert.equal(fs.existsSync(values.sourcePaths[0]), true);
});

test("retention deletion recovery requires the original fixed manifest", (t) => {
  const values = fixture(t);
  authorize(values);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...values.applyOptions,
        afterOriginalRemoval: ({ index }) => {
          if (index === 0) throw new Error("stop");
        },
      }),
    /stop/,
  );
  fs.unlinkSync(values.manifestPath);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...values.applyOptions,
        now: new Date("2026-09-17T00:03:00.000Z"),
      }),
    /回復manifestが見つかりません/,
  );
});

test("retention deletion refuses a second application", (t) => {
  const values = fixture(t);
  authorize(values);
  applyStage0RetentionDeletion(values.applyOptions);
  assert.throws(
    () => applyStage0RetentionDeletion(values.applyOptions),
    /適用済み/,
  );
});

test("post-deletion audit is read-only and verifies the completed chain", (t) => {
  const values = fixture(t);
  authorize(values);
  applyStage0RetentionDeletion(values.applyOptions);
  const before = directorySnapshot(values.privateRoot);
  const result = auditStage0RetentionDeletion({
    ...values.applyOptions,
    now: new Date("2026-09-17T00:04:00.000Z"),
  });
  assert.deepEqual(result, {
    state: "DELETION_VERIFIED",
    evidenceCount: 5,
    recoveredAfterInterruption: false,
    originalEvidenceAbsent: true,
    quarantinePayloadsAbsent: true,
  });
  assert.deepEqual(directorySnapshot(values.privateRoot), before);
});

test("post-deletion audit rejects payload reappearance, tampering, and concurrent changes", (t) => {
  const reappeared = fixture(t);
  authorize(reappeared);
  applyStage0RetentionDeletion(reappeared.applyOptions);
  write(reappeared.planPath, { restored: true });
  assert.throws(
    () => auditStage0RetentionDeletion(reappeared.applyOptions),
    /残っています|対象外|一致/,
  );

  const tampered = fixture(t);
  authorize(tampered);
  applyStage0RetentionDeletion(tampered.applyOptions);
  fs.appendFileSync(tampered.receiptPath, " ");
  assert.throws(
    () => auditStage0RetentionDeletion(tampered.applyOptions),
    /JSON|不正|改変/,
  );

  const concurrent = fixture(t);
  authorize(concurrent);
  applyStage0RetentionDeletion(concurrent.applyOptions);
  assert.throws(
    () =>
      auditStage0RetentionDeletion({
        ...concurrent.applyOptions,
        beforeFinalVerification: () =>
          fs.appendFileSync(concurrent.receiptPath, " "),
      }),
    /処理中に変更/,
  );
});

test("post-deletion audit CLI does not disclose private paths or candidate data", (t) => {
  const values = fixture(t);
  authorize(values);
  applyStage0RetentionDeletion(values.applyOptions);
  const args = [
    path.join(
      scriptDirectory,
      "adult-pilot-stage0-retention-deletion-audit.mjs",
    ),
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
    "--deletion-authorization",
    values.deletionAuthorizationPath,
    "--quarantine-dir",
    values.quarantineDirectory,
  ];
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DELETION_VERIFIED/);
  assert.doesNotMatch(
    result.stdout,
    /candidate-|assessment\.json|retention-recovery|private/i,
  );
});

test("retention deletion lifecycle audit reports proposal, authorization, and expiration without writes", (t) => {
  const values = fixture(t);
  const proposalBefore = directorySnapshot(values.privateRoot);
  assert.equal(
    auditStage0RetentionDeletionLifecycle(values.applyOptions).state,
    "PROPOSAL_READY",
  );
  assert.deepEqual(directorySnapshot(values.privateRoot), proposalBefore);

  authorize(values);
  const authorizedBefore = directorySnapshot(values.privateRoot);
  const authorized = auditStage0RetentionDeletionLifecycle(values.applyOptions);
  assert.equal(authorized.state, "AUTHORIZED");
  assert.equal(authorized.authorizationExpired, false);
  assert.deepEqual(directorySnapshot(values.privateRoot), authorizedBefore);

  const expired = auditStage0RetentionDeletionLifecycle({
    ...values.applyOptions,
    now: new Date("2026-09-17T01:01:00.001Z"),
  });
  assert.equal(expired.state, "AUTHORIZED");
  assert.equal(expired.authorizationExpired, true);
});

test("retention deletion lifecycle audit distinguishes manifest and delete-intent preparation", (t) => {
  const manifest = fixture(t);
  authorize(manifest);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...manifest.applyOptions,
        afterManifest: () => {
          throw new Error("manifest prepared");
        },
      }),
    /manifest prepared/,
  );
  assert.equal(
    auditStage0RetentionDeletionLifecycle(manifest.applyOptions).state,
    "MANIFEST_PREPARED",
  );

  const intent = fixture(t);
  authorize(intent);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...intent.applyOptions,
        afterDeleteIntent: () => {
          throw new Error("delete intent prepared");
        },
      }),
    /delete intent prepared/,
  );
  const result = auditStage0RetentionDeletionLifecycle(intent.applyOptions);
  assert.equal(result.state, "DELETE_PREPARED");
  assert.equal(result.originalsAbsent, 0);
  assert.equal(result.recoveryPayloadsPresent, 0);
  const expiredPrepared = auditStage0RetentionDeletionLifecycle({
    ...intent.applyOptions,
    now: new Date("2026-09-17T02:00:00.000Z"),
  });
  assert.equal(expiredPrepared.state, "DELETE_PREPARED");
  assert.equal(expiredPrepared.authorizationExpired, true);
  assert.equal(
    applyStage0RetentionDeletion({
      ...intent.applyOptions,
      now: new Date("2026-09-17T02:00:00.000Z"),
    }).recovered,
    true,
  );
});

test("retention deletion lifecycle audit distinguishes staging recovery and purge readiness", (t) => {
  const partial = fixture(t);
  authorize(partial);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...partial.applyOptions,
        afterOriginalRemoval: ({ index }) => {
          if (index === 0) throw new Error("partial staging");
        },
      }),
    /partial staging/,
  );
  const partialResult = auditStage0RetentionDeletionLifecycle(
    partial.applyOptions,
  );
  assert.equal(partialResult.state, "STAGING_RECOVERY_REQUIRED");
  assert.equal(partialResult.originalsAbsent, 1);
  assert.equal(partialResult.recoveryPayloadsPresent, 1);

  const staged = fixture(t);
  authorize(staged);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...staged.applyOptions,
        afterOriginalRemoval: ({ index }) => {
          if (index === staged.sourcePaths.length - 1)
            throw new Error("all originals staged");
        },
      }),
    /all originals staged/,
  );
  const stagedResult = auditStage0RetentionDeletionLifecycle(
    staged.applyOptions,
  );
  assert.equal(stagedResult.state, "PURGE_READY");
  assert.equal(stagedResult.originalsAbsent, 5);
  assert.equal(stagedResult.recoveryPayloadsPresent, 5);
});

test("retention deletion lifecycle audit distinguishes purge and receipt recovery", (t) => {
  const prepared = fixture(t);
  authorize(prepared);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...prepared.applyOptions,
        afterPurgeIntent: () => {
          throw new Error("purge prepared");
        },
      }),
    /purge prepared/,
  );
  assert.equal(
    auditStage0RetentionDeletionLifecycle(prepared.applyOptions).state,
    "PURGE_PREPARED",
  );

  const partial = fixture(t);
  authorize(partial);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...partial.applyOptions,
        afterQuarantinePurge: ({ index }) => {
          if (index === 0) throw new Error("partial purge");
        },
      }),
    /partial purge/,
  );
  assert.equal(
    auditStage0RetentionDeletionLifecycle(partial.applyOptions).state,
    "PURGE_RECOVERY_REQUIRED",
  );

  const receipt = fixture(t);
  authorize(receipt);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...receipt.applyOptions,
        afterQuarantinePurge: ({ index }) => {
          if (index === receipt.sourcePaths.length - 1)
            throw new Error("receipt recovery");
        },
      }),
    /receipt recovery/,
  );
  const receiptResult = auditStage0RetentionDeletionLifecycle(
    receipt.applyOptions,
  );
  assert.equal(receiptResult.state, "RECEIPT_RECOVERY_REQUIRED");
  assert.equal(receiptResult.recoveryPayloadsPresent, 0);
});

test("retention deletion lifecycle audit verifies completion and remains read-only", (t) => {
  const values = fixture(t);
  authorize(values);
  applyStage0RetentionDeletion(values.applyOptions);
  const before = directorySnapshot(values.privateRoot);
  const result = auditStage0RetentionDeletionLifecycle({
    ...values.applyOptions,
    now: new Date("2026-09-17T02:00:00.000Z"),
  });
  assert.equal(result.state, "DELETED");
  assert.equal(result.authorizationExpired, true);
  assert.equal(result.originalsAbsent, 5);
  assert.equal(result.recoveryPayloadsPresent, 0);
  assert.deepEqual(directorySnapshot(values.privateRoot), before);
});

test("retention deletion lifecycle audit fails closed on missing, unknown, and concurrent state", (t) => {
  const missing = fixture(t);
  authorize(missing);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...missing.applyOptions,
        afterOriginalRemoval: ({ index }) => {
          if (index === 0) throw new Error("stop");
        },
      }),
    /stop/,
  );
  const payload = fs
    .readdirSync(missing.quarantineDirectory)
    .find((name) => name.endsWith(".evidence"));
  fs.unlinkSync(path.join(missing.quarantineDirectory, payload));
  assert.throws(
    () => auditStage0RetentionDeletionLifecycle(missing.applyOptions),
    /両方から証跡が失われています/,
  );

  const unknown = fixture(t);
  authorize(unknown);
  assert.throws(
    () =>
      applyStage0RetentionDeletion({
        ...unknown.applyOptions,
        afterManifest: () => {
          throw new Error("stop");
        },
      }),
    /stop/,
  );
  write(path.join(unknown.quarantineDirectory, "unknown.txt"), "unknown");
  assert.throws(
    () => auditStage0RetentionDeletionLifecycle(unknown.applyOptions),
    /未承認file/,
  );

  const concurrent = fixture(t);
  authorize(concurrent);
  assert.throws(
    () =>
      auditStage0RetentionDeletionLifecycle({
        ...concurrent.applyOptions,
        beforeFinalVerification: () =>
          fs.appendFileSync(concurrent.deletionAuthorizationPath, " "),
      }),
    /処理中に変更/,
  );
});

test("retention deletion lifecycle audit CLI hides private data", (t) => {
  const values = fixture(t);
  authorize(values);
  applyStage0RetentionDeletion(values.applyOptions);
  const result = spawnSync(
    process.execPath,
    [
      path.join(
        scriptDirectory,
        "adult-pilot-stage0-retention-deletion-lifecycle-audit.mjs",
      ),
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
      "--deletion-authorization",
      values.deletionAuthorizationPath,
      "--quarantine-dir",
      values.quarantineDirectory,
    ],
    { encoding: "utf8", env: process.env },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /State: DELETED/);
  assert.doesNotMatch(
    result.stdout,
    /candidate-|assessment\.json|retention-recovery|private/i,
  );
});
