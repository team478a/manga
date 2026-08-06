import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("更新情報は公開済みだけをダッシュボードへ表示する", async () => {
  const [migration, dashboard, admin] = await Promise.all([
    read("../supabase/migrations/202608030001_cloud_monitor_operations_hub.sql"),
    read("../src/app/dashboard/page.tsx"),
    read("../src/app/admin/product-updates/page.tsx"),
  ]);
  assert.match(migration, /create table if not exists public\.cloud_product_updates/);
  assert.match(migration, /published_at is not null/);
  assert.match(migration, /archived_at is null/);
  assert.match(dashboard, /cloud_product_updates/);
  assert.match(dashboard, /更新情報/);
  assert.match(admin, /更新情報を追加/);
});

test("モニター報告は種類・影響度・環境を構造化して保存する", async () => {
  const [migration, page, actions] = await Promise.all([
    read("../supabase/migrations/202608030001_cloud_monitor_operations_hub.sql"),
    read("../src/app/dashboard/monitor/page.tsx"),
    read("../src/app/dashboard/monitor/actions.ts"),
  ]);
  for (const type of ["bug", "improvement", "feature_request"]) {
    assert.match(migration, new RegExp(type));
    assert.match(page, new RegExp(type));
  }
  assert.match(actions, /request_type/);
  assert.match(actions, /page_url/);
  assert.match(actions, /environment/);
});

test("同種報告は指紋で集約し管理者許可後だけ自動修正キューへ入る", async () => {
  const [migration, admin] = await Promise.all([
    read("../supabase/migrations/202608030001_cloud_monitor_operations_hub.sql"),
    read("../src/app/admin/monitor-issues/page.tsx"),
  ]);
  assert.match(migration, /triage_fingerprint/);
  assert.match(migration, /on conflict\s*\(fingerprint\)/);
  assert.match(migration, /occurrence_count=public\.cloud_monitor_issue_tasks\.occurrence_count\+1/);
  assert.match(migration, /status='queued'/);
  assert.match(admin, /自動修正を許可/);
  assert.match(admin, /自動マージと本番デプロイは行いません/);
});

test("Worker APIは秘密鍵と停止フラグでfail closedする", async () => {
  const worker = await read("../src/app/api/internal/monitor-ops/worker/route.ts");
  assert.match(worker, /MANGAI_MONITOR_OPS_WORKER_SECRET/);
  assert.match(worker, /expected\.length < 32/);
  assert.match(worker, /!featureFlagEnabled\("MANGAI_MONITOR_OPS_WORKER_ENABLED"\)/);
  assert.match(worker, /claim_cloud_monitor_issue_task/);
  assert.match(worker, /complete_cloud_monitor_issue_task/);
  assert.doesNotMatch(worker, /mergePullRequest|production deploy/i);
});

test("rollbackは運用ハブの追加オブジェクトを除去する", async () => {
  const rollback = await read("../supabase/rollbacks/202608030001_cloud_monitor_operations_hub.sql");
  assert.match(rollback, /drop table if exists public\.cloud_monitor_issue_tasks/);
  assert.match(rollback, /drop table if exists public\.cloud_product_updates/);
  assert.match(rollback, /drop column if exists request_type/);
});
