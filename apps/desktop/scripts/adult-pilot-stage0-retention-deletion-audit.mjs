import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parseRetentionArgs } from "./adult-pilot-stage0-retention-proposal.mjs";
import {
  canonicalRetentionDeletionBytes,
  readRetentionDeletionContext,
  validateRetentionDeleteIntent,
  validateRetentionDeletionReceipt,
  validateRetentionPurgeIntent,
  validateRetentionQuarantineManifest,
} from "./adult-pilot-stage0-retention-apply.mjs";
import {
  digest,
  readFile,
  readJson,
} from "./adult-pilot-stage1-invite-ledger-proposal.mjs";

const snapshot = (targets) =>
  new Map(
    targets.map((target) => [
      path.resolve(target),
      fs.existsSync(target)
        ? digest(readFile(target, "保持期限削除後監査対象"))
        : null,
    ]),
  );

const assertSnapshotUnchanged = (observed) => {
  for (const [target, expected] of observed) {
    const exists = fs.existsSync(target);
    if (
      (expected === null && exists) ||
      (expected !== null &&
        (!exists ||
          digest(readFile(target, "保持期限削除後監査対象")) !== expected))
    )
      throw new Error("保持期限削除後監査の対象が処理中に変更されました。");
  }
};

export const auditStage0RetentionDeletion = (rawOptions) => {
  let context = readRetentionDeletionContext(rawOptions);
  const observedTargets = [
    context.options.proposalPath,
    context.options.deletionAuthorizationPath,
    context.paths.manifestPath,
    context.paths.deleteIntentPath,
    context.paths.purgeIntentPath,
    context.paths.receiptPath,
    ...context.evidence.flatMap((item) => [item.target, item.quarantinePath]),
  ];
  const before = snapshot(observedTargets);

  const manifestBytes = readFile(
    context.paths.manifestPath,
    "Stage 0保持期限回復manifest",
  );
  const manifest = validateRetentionQuarantineManifest(
    readJson(manifestBytes, "Stage 0保持期限回復manifest"),
    context,
  );
  context = {
    ...context,
    manifest,
    manifestBytes,
    manifestSha256: digest(manifestBytes),
  };

  const deleteIntentBytes = readFile(
    context.paths.deleteIntentPath,
    "Stage 0保持期限削除intent",
  );
  const deleteIntent = validateRetentionDeleteIntent(
    readJson(deleteIntentBytes, "Stage 0保持期限削除intent"),
    context,
  );
  context = {
    ...context,
    deleteIntent,
    deleteIntentBytes,
    deleteIntentSha256: digest(deleteIntentBytes),
  };

  const purgeIntentBytes = readFile(
    context.paths.purgeIntentPath,
    "Stage 0保持期限回復領域purge intent",
  );
  const purgeIntent = validateRetentionPurgeIntent(
    readJson(purgeIntentBytes, "Stage 0保持期限回復領域purge intent"),
    context,
  );
  context = {
    ...context,
    purgeIntent,
    purgeIntentBytes,
    purgeIntentSha256: digest(purgeIntentBytes),
  };

  const receiptBytes = readFile(
    context.paths.receiptPath,
    "Stage 0保持期限削除receipt",
  );
  const receipt = validateRetentionDeletionReceipt(
    readJson(receiptBytes, "Stage 0保持期限削除receipt"),
    context,
  );
  if (!canonicalRetentionDeletionBytes(receipt).equals(receiptBytes))
    throw new Error("Stage 0保持期限削除receiptが改変されています。");
  for (const item of context.evidence)
    if (fs.existsSync(item.target) || fs.existsSync(item.quarantinePath))
      throw new Error("Stage 0保持期限削除後も証跡payloadが残っています。");
  const remaining = fs.readdirSync(context.options.quarantineDirectory);
  if (
    remaining.length !== 1 ||
    remaining[0] !== path.basename(context.paths.manifestPath)
  )
    throw new Error("Stage 0保持期限回復領域に未承認fileが残っています。");

  if (typeof context.options.beforeFinalVerification === "function")
    context.options.beforeFinalVerification();
  assertSnapshotUnchanged(before);
  return {
    state: "DELETION_VERIFIED",
    evidenceCount: context.evidence.length,
    recoveredAfterInterruption: receipt.recoveredAfterInterruption,
    originalEvidenceAbsent: true,
    quarantinePayloadsAbsent: true,
  };
};

const valueFlags = new Set([
  "--assessment",
  "--plan",
  "--artifact-evidence",
  "--bundle-evidence",
  "--package",
  "--start-authorization",
  "--hardware-evidence",
  "--proposal",
  "--deletion-authorization",
  "--quarantine-dir",
]);
const booleanFlags = new Set();

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const args = parseRetentionArgs(
      process.argv.slice(2),
      valueFlags,
      booleanFlags,
    );
    for (const flag of [
      "--assessment",
      "--plan",
      "--artifact-evidence",
      "--bundle-evidence",
      "--package",
      "--proposal",
      "--deletion-authorization",
      "--quarantine-dir",
    ])
      if (!args.has(flag))
        throw new Error("Stage 0保持期限削除後監査の引数が不足しています。");
    const result = auditStage0RetentionDeletion({
      assessmentPath: args.get("--assessment"),
      planPath: args.get("--plan"),
      artifactEvidencePath: args.get("--artifact-evidence"),
      bundleEvidencePath: args.get("--bundle-evidence"),
      packagePath: args.get("--package"),
      authorizationPath: args.get("--start-authorization"),
      hardwareEvidencePath: args.get("--hardware-evidence"),
      proposalPath: args.get("--proposal"),
      deletionAuthorizationPath: args.get("--deletion-authorization"),
      quarantineDirectory: args.get("--quarantine-dir"),
    });
    console.log("MANGAI Desktop Adult Stage 0 retention deletion audit");
    console.log(`  State: ${result.state}`);
    console.log(`  Evidence files verified absent: ${result.evidenceCount}`);
    console.log("  Recovery payloads verified absent: yes");
    console.log("  Candidate identity, content, and paths: hidden");
    console.log("  Files changed: no");
    console.log("  External action: no");
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error
        ? "Stage 0保持期限削除後監査のfile操作に失敗しました。"
        : error.message;
    console.error(`Stage 0 retention deletion audit failed: ${message}`);
    process.exit(1);
  }
}
