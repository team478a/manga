import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/202608010011_cloud_project_checkpoints.sql", "utf8");
const service = fs.readFileSync("src/modules/cloud-creator/projects/project-checkpoint-service.ts", "utf8");
const application = fs.readFileSync("src/modules/manga/application/manage-project-checkpoint.ts", "utf8");
const panel = fs.readFileSync("src/app/creator/[projectId]/ProjectCheckpointPanel.tsx", "utf8");

test("変更のないCanvasはハッシュ単位で再利用する", () => {
  assert.match(migration, /digest\(convert_to\(v_canvas::text,'UTF8'\),'sha256'\)/);
  assert.match(migration, /primary key\(project_id,content_sha256\)/);
  assert.match(migration, /on conflict\(project_id,content_sha256\) do nothing/);
});

test("実行中生成と未確定ページがある完成版固定をDBで拒否する", () => {
  assert.match(migration, /status in\('queued','running'\)/);
  assert.match(migration, /cloud_project_checkpoint_generation_active/);
  assert.match(migration, /production_status<>'finalized'/);
  assert.match(migration, /finalized_revision is distinct from revision/);
  assert.match(migration, /cloud_project_checkpoint_pages_not_finalized/);
});

test("完成版作成は原稿preflightを通り、UIは処理中状態を表示する", () => {
  assert.match(service, /requireFinalizedPages: true/);
  assert.match(service, /createProjectCheckpoint/);
  assert.match(application, /if \(!report\.ready\)/);
  assert.match(panel, /pendingLabel="作成中…"/);
  assert.match(panel, /pendingLabel="固定中…"/);
  assert.match(panel, /disabled={!releaseReady}/);
  assert.doesNotMatch(panel, /manifestSha256|canvasSha256|provider_id|model_id/);
});

test("固定版は100ページ上限と所有権RLSを持つ", () => {
  assert.match(migration, /page_count between 1 and 100/);
  assert.match(migration, /cloud_project_can_edit\(p_project_id\)/);
  assert.match(migration, /cloud_project_can_read\(project_id\)/);
  assert.match(migration, /revoke all on function public\.create_cloud_project_checkpoint/);
});
