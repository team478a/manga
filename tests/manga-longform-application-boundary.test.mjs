import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeGenerationBatchPageIds,
  summarizeGenerationBatches,
} from "../src/modules/manga/domain/generation-batch.ts";
import {
  assertUserSelectableProductionStatus,
  buildPageProductionStates,
} from "../src/modules/manga/domain/production-state.ts";
import {
  createProjectCheckpoint,
  restoreProjectCheckpoint,
} from "../src/modules/manga/application/manage-project-checkpoint.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("一括生成は4〜8ページ、重複除去、64コマ上限のdomain境界を使う", () => {
  assert.deepEqual(
    normalizeGenerationBatchPageIds(["a", "a", "b", "c", "d"]),
    ["a", "b", "c", "d"],
  );
  assert.throws(() => normalizeGenerationBatchPageIds(["a", "b", "c"]));
  assert.throws(() =>
    normalizeGenerationBatchPageIds(["1", "2", "3", "4", "5", "6", "7", "8", "9"]),
  );
});

test("一括生成履歴は全Job完了時だけ表示状態をcompletedへ変換する", () => {
  const base = {
    id: "batch",
    status: "active",
    requested_page_ids: ["1", "2", "3", "4"],
    created_at: "2026-08-06T00:00:00.000Z",
  };
  const [completed] = summarizeGenerationBatches({
    batches: [base],
    links: [
      { batch_id: "batch", job_id: "a", status: "completed" },
      { batch_id: "batch", job_id: "b", status: "completed" },
    ],
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.completedJobs, 2);
  const [failed] = summarizeGenerationBatches({
    batches: [base],
    links: [{ batch_id: "batch", job_id: "c", status: "failed" }],
  });
  assert.equal(failed.status, "active");
  assert.deepEqual(failed.failedJobIds, ["c"]);

  const canceledWithoutJobs = summarizeGenerationBatches({
    batches: [{ ...base, status: "canceled" }],
    links: [],
  });
  assert.deepEqual(canceledWithoutJobs, []);
});

test("制作状態は確定revisionの古さを判定しgenerating手動指定を拒否する", () => {
  const [state] = buildPageProductionStates({
    pages: [{ id: "page", revision: 4 }],
    contextRevision: 3,
    rows: [{
      id: "page",
      production_status: "finalized",
      production_status_updated_at: null,
      finalized_revision: 4,
      reviewed_context_revision: 2,
    }],
  });
  assert.equal(state.status, "finalized");
  assert.equal(state.isStale, true);
  assert.throws(() => assertUserSelectableProductionStatus("generating"));
  assert.doesNotThrow(() => assertUserSelectableProductionStatus("review_required"));
});

test("完成版はpreflight成功後だけrepositoryへ委譲し復元入力を維持する", async () => {
  const calls = [];
  const repository = {
    create: async (input) => { calls.push(["create", input]); return "checkpoint"; },
    restore: async (input) => { calls.push(["restore", input]); return "revision"; },
  };
  await assert.rejects(() => createProjectCheckpoint({
    projectId: "project",
    label: "release",
    kind: "release",
    repository,
    inspectRelease: async () => ({ ready: false }),
  }));
  assert.equal(calls.length, 0);
  await createProjectCheckpoint({
    projectId: "project",
    label: "release",
    kind: "release",
    repository,
    inspectRelease: async () => ({ ready: true }),
  });
  await restoreProjectCheckpoint({ projectId: "project", checkpointId: "checkpoint", repository });
  assert.deepEqual(calls.map(([name]) => name), ["create", "restore"]);
});

test("旧serviceはManga domain/applicationを利用しSupabase契約を維持する", async () => {
  const [batch, production, cockpit, checkpoint, longformApplication] = await Promise.all([
    read("../src/modules/cloud-creator/generation/batch-production-service.ts"),
    read("../src/modules/cloud-creator/production/production-status-service.ts"),
    read("../src/modules/cloud-creator/projects/longform-cockpit-service.ts"),
    read("../src/modules/cloud-creator/projects/project-checkpoint-service.ts"),
    read("../src/modules/manga/application/inspect-longform-production.ts"),
  ]);
  assert.match(batch, /manga\/domain\/generation-batch/);
  assert.match(batch, /create_cloud_generation_batch/);
  assert.match(batch, /replace_cloud_generation_batch_job/);
  assert.match(production, /manga\/domain\/production-state/);
  assert.match(production, /set_cloud_page_production_status/);
  assert.match(cockpit, /inspectLongformProduction/);
  assert.match(checkpoint, /manage-project-checkpoint/);
  assert.match(checkpoint, /restore_cloud_project_checkpoint/);
  assert.doesNotMatch(longformApplication, /supabase|cloudCreatorContext|\.rpc\(/);
});
