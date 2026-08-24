import assert from "node:assert/strict";
import test from "node:test";
import { planGenerationRunResume } from "../src/modules/cloud-ai/domain/generation-run-checkpoint.ts";

const uuid = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

test("20ページの中断後は完了済みAssetを維持して未完了コマだけ再開する", () => {
  const targets = Array.from({ length: 20 }, (_, index) => ({
    targetId: uuid(index + 1),
    pageId: uuid(100 + index),
    panelId: uuid(200 + index),
    sourcePageRevision: 3,
  }));
  const checkpoints = targets.slice(0, 13).map((target, index) => ({
    ...target,
    jobId: uuid(300 + index),
    outputAssetId: uuid(400 + index),
    outputSha256: String(index + 1).padStart(64, "a"),
  }));

  const beforeRestart = new Map(checkpoints.map((item) => [item.targetId, {
    assetId: item.outputAssetId,
    sha256: item.outputSha256,
  }]));
  const plan = planGenerationRunResume({ targets, checkpoints });

  assert.equal(plan.completed.length, 13);
  assert.deepEqual(plan.pending.map((item) => item.targetId), targets.slice(13).map((item) => item.targetId));
  assert.deepEqual(
    new Map(plan.completed.map((item) => [item.targetId, { assetId: item.outputAssetId, sha256: item.outputSha256 }])),
    beforeRestart,
  );
});

test("revisionまたはdigestが一致しないcheckpointは再開対象に戻す", () => {
  const target = { targetId: uuid(1), pageId: uuid(2), panelId: uuid(3), sourcePageRevision: 4 };
  const base = { ...target, jobId: uuid(4), outputAssetId: uuid(5), outputSha256: "b".repeat(64) };
  assert.equal(planGenerationRunResume({ targets: [target], checkpoints: [{ ...base, sourcePageRevision: 3 }] }).pending.length, 1);
  assert.equal(planGenerationRunResume({ targets: [target], checkpoints: [{ ...base, outputSha256: "invalid" }] }).pending.length, 1);
});
