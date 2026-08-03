import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const actions = await readFile("src/app/admin/cloud-ai/actions.ts", "utf8");
const page = await readFile("src/app/admin/cloud-ai/page.tsx", "utf8");

test("admin can cancel queued or running jobs through the authenticated RPC", () => {
  assert.match(actions, /cancelCloudAiJobAction/);
  assert.match(actions, /createClient\(\)/);
  assert.match(actions, /cancel_cloud_generation_job/);
  assert.match(actions, /\["queued", "running"\]/);
  assert.match(actions, /cancel_generation_job/);
});

test("job operations UI shows safe state and pending feedback", () => {
  assert.match(page, /生成Jobの確認・取消/);
  assert.match(page, /pendingLabel="取消中…"/);
  assert.match(page, /失敗Jobの再生成は作品編集画面から/);
  assert.doesNotMatch(page, /job\.error_message/);
});
