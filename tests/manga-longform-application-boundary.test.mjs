import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const boundaries = [
  [
    "src/modules/cloud-creator/generation/batch-production-service.ts",
    "lib/cloud-manga-generation-batch",
  ],
  [
    "src/modules/cloud-creator/production/production-status-service.ts",
    "lib/cloud-manga-production-state",
  ],
  [
    "src/modules/cloud-creator/projects/narrative-continuity-service.ts",
    "lib/cloud-manga-continuity",
  ],
  [
    "src/modules/cloud-creator/projects/project-budget-service.ts",
    "lib/cloud-manga-project-budget",
  ],
  [
    "src/modules/cloud-creator/projects/project-checkpoint-service.ts",
    "lib/cloud-manga-checkpoint",
  ],
  [
    "src/modules/cloud-creator/projects/project-checkpoint-diff.ts",
    "lib/cloud-manga-checkpoint-diff",
  ],
];

test("旧長編service入口はManga moduleの公開境界を再exportする", async () => {
  for (const [legacyPath, modulePath] of boundaries) {
    const legacy = await read(legacyPath);
    assert.match(legacy, /export \* from/);
    assert.match(legacy, new RegExp(modulePath));
    assert.doesNotMatch(legacy, /cloudCreatorContext|supabase\.rpc|supabase\.from/);
  }
});

test("一括生成の件数・確定ページ・補償契約を移動後も維持する", async () => {
  const application = await read(
    "src/modules/manga/application/manage-generation-batch.ts",
  );
  assert.match(application, /uniquePageIds\.length < 4 \|\| uniquePageIds\.length > 8/);
  assert.match(application, /targets\.length > 64/);
  assert.match(application, /production_status === "finalized"/);
  assert.match(application, /cancelCloudGenerationJob/);
  assert.match(application, /replace_cloud_generation_batch_job/);
});

test("制作状態・予算・checkpointは既存RPC名を維持する", async () => {
  const production = await read(
    "src/modules/manga/application/manage-production-state.ts",
  );
  const budget = await read(
    "src/modules/manga/application/manage-project-budget.ts",
  );
  const checkpoint = await read(
    "src/modules/manga/application/manage-checkpoint.ts",
  );
  assert.match(production, /set_cloud_page_production_status/);
  assert.match(budget, /get_cloud_project_resource_usage/);
  assert.match(budget, /save_cloud_project_resource_budget/);
  assert.match(checkpoint, /create_cloud_project_checkpoint/);
  assert.match(checkpoint, /restore_cloud_project_checkpoint/);
});

test("checkpoint差分domainはframework・DB・Storageへ依存しない", async () => {
  const domain = await read("src/modules/manga/domain/checkpoint-diff.ts");
  assert.match(domain, /summarizeCloudCheckpointDiff/);
  assert.doesNotMatch(domain, /next\/|react|supabase|cloudCreatorContext|node:fs/);
});
