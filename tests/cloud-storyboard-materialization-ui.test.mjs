import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(
  "src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/versions/[storyboardVersionId]/page.tsx",
  "utf8",
);
const action = fs.readFileSync(
  "src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/actions.ts",
  "utf8",
);
const migration = fs.readFileSync(
  "supabase/migrations/202607300005_cloud_storyboard_canvas_materialization.sql",
  "utf8",
);

test("採用済みネーム画面からCanvas作成または既存Canvasを開ける", () => {
  assert.match(route, /Canvas下書きを作成/);
  assert.match(route, /Canvasを開く/);
  assert.match(route, /materializeCloudStoryboardAction/);
  assert.match(action, /cloudStoryboardCanvasFeatureEnabled/);
  assert.match(action, /getLatestCloudStoryboardAdoption/);
});

test("変換RPCは所有者・一般向け・最新採用版・冪等性をDBで検証する", () => {
  assert.match(migration, /owner_profile_id=v_profile_id/);
  assert.match(migration, /v_content_class is distinct from 'general'/);
  assert.match(migration, /latest_adopted_storyboard_required/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /storyboard_version_id uuid not null unique/);
});

test("変換はCanvas構造のみを作り画像生成を開始しない", () => {
  assert.match(migration, /'panels'/);
  assert.match(migration, /'balloons'/);
  assert.match(migration, /'textObjects'/);
  assert.doesNotMatch(migration, /cloud_generation_jobs|enqueue_cloud_generation|cloud_assets/);
  assert.doesNotMatch(action, /provider|image generation|画像生成API/);
});

test("Release 5画面は固定横幅を持たず既存レスポンシブ基盤を維持する", () => {
  assert.doesNotMatch(route, /min-w-\[[0-9]+px\]|w-\[[1-9][0-9]{3,}px\]/);
});
