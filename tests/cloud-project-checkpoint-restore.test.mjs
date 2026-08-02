import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/202608020003_cloud_project_checkpoint_restore.sql", "utf8");
const service = fs.readFileSync("src/modules/cloud-creator/projects/project-checkpoint-service.ts", "utf8");
const panel = fs.readFileSync("src/app/creator/[projectId]/ProjectCheckpointPanel.tsx", "utf8");

test("復元前バックアップを構造変更より先に同一transactionで作る", () => {
  const backup = migration.indexOf("v_pre_restore_checkpoint_id:=public.create_cloud_project_checkpoint");
  const structureUpdate = migration.indexOf("update public.cloud_chapters set order_index");
  assert.ok(backup > 0 && structureUpdate > backup);
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;\s*$/);
});

test("生成中・編集中の復元をDBで拒否する", () => {
  assert.match(migration, /status in\('queued','running'\)/);
  assert.match(migration, /cloud_project_checkpoint_restore_generation_active/);
  assert.match(migration, /lease_expires_at>now\(\)/);
  assert.match(migration, /cloud_project_checkpoint_restore_page_locked/);
});

test("復元後もrevisionを単調増加させ全ページを要再確認にする", () => {
  assert.match(migration, /revision=cloud_chapters\.revision\+1/);
  assert.match(migration, /revision=cloud_episodes\.revision\+1/);
  assert.match(migration, /revision=cloud_scenes\.revision\+1/);
  assert.match(migration, /update public\.cloud_pages set revision=revision\+1/);
  assert.match(migration, /production_status='revision_required'/);
  assert.match(migration, /finalized_revision=null,reviewed_context_revision=null/);
  assert.match(migration, /update public\.cloud_assets set deleted_at=now\(\)/);
});

test("復元監査は所有権RLSを持ち、別作品checkpointを拒否する", () => {
  assert.match(migration, /where id=p_checkpoint_id\s+and project_id=p_project_id/);
  assert.match(migration, /cloud_project_can_edit\(p_project_id\)/);
  assert.match(migration, /cloud_project_checkpoint_restores_read/);
  assert.match(migration, /cloud_project_can_read\(project_id\)/);
  assert.match(migration, /revoke all on function public\.restore_cloud_project_checkpoint/);
});

test("利用者UIは明示確認と処理中表示を要求する", () => {
  assert.match(panel, /name="confirm" required type="checkbox" value="restore"/);
  assert.match(panel, /pendingLabel="復元中…"/);
  assert.match(panel, /現在の内容は自動バックアップ後に置き換わります/);
  assert.match(service, /restore_cloud_project_checkpoint/);
  assert.match(service, /画像生成が完了してから復元してください/);
  assert.doesNotMatch(panel, /manifestSha256|canvasSha256|provider_id|model_id/);
});
