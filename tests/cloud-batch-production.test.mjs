import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("batch migration limits work and protects owner data", () => {
  const sql = read("supabase/migrations/202608010004_cloud_batch_production.sql");
  assert.match(sql, /cardinality\(requested_page_ids\) between 4 and 8/);
  assert.match(sql, /count\(distinct page_id\)/);
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /created_by_profile_id=public\.current_profile_id\(\)/);
  assert.match(sql, /batch\.status in\('paused','canceled'\)/);
  assert.match(sql, /batch\.status in\('active','paused'\)/);
  assert.match(sql, /if v_count>0 then delete/);
});

test("page locks expire and require an opaque token", () => {
  const sql = read("supabase/migrations/202608010004_cloud_batch_production.sql");
  assert.match(sql, /p_lease_seconds not between 60 and 300/);
  assert.match(sql, /lease_expires_at<=now\(\)/);
  assert.match(sql, /lock_token=p_lock_token/);
  assert.match(sql, /cloud_page_locked/);
});

test("batch service reuses the billed queue and bounds panel work", () => {
  const service = read("src/modules/cloud-creator/generation/batch-production-service.ts");
  const policy = read("src/modules/manga/domain/generation-batch.ts");
  assert.match(policy, /uniquePageIds\.length < 4 \|\| uniquePageIds\.length > 8/);
  assert.match(policy, /targets\.length > 64/);
  assert.match(service, /normalizeGenerationBatchPageIds/);
  assert.match(service, /planGenerationBatchTargets/);
  assert.match(service, /enqueueStoryboardPanelImage/);
  assert.match(service, /cloudGenerationInputSchema\.safeParse/);
  assert.match(service, /enqueueCloudGenerationJob/);
  assert.match(service, /replace_cloud_generation_batch_job/);
  assert.match(service, /Number\(replaced\.data\) < 1/);
});

test("batch UI exposes progress, pause, cancel and safe retry", () => {
  const component = read("src/app/creator/[projectId]/LongformPageManager.tsx");
  assert.match(component, /4〜8ページをまとめて生成/);
  assert.match(component, /一時停止/);
  assert.match(component, /再開/);
  assert.match(component, /中止/);
  assert.match(component, /失敗\{index \+ 1\}を再実行/);
  assert.match(component, /batch\.status === "active" \|\| batch\.status === "paused"/);
});

test("canvas editor obtains and releases a server edit lease", () => {
  const editor = read("src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx");
  const client = read("src/app/creator/[projectId]/pages/[pageId]/services/page-edit-lock-client.ts");
  assert.match(editor, /acquirePageEditLease/);
  assert.match(editor, /releasePageEditLease/);
  assert.match(editor, /別の画面で編集中です/);
  assert.match(client, /\/api\/creator\/page-locks\/\$\{encodeURIComponent\(pageId\)\}/);
  assert.match(client, /method: "DELETE"/);
  assert.match(client, /keepalive: true/);
});
