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

test("更新情報は購入者向け先行利用で利用できる範囲と対象外を明示する", async () => {
  const dashboard = await read("../src/app/dashboard/page.tsx");

  for (const available of [
    "市場分析",
    "AI企画",
    "シナリオ",
    "ネーム",
    "Cloud原稿編集",
    "人物・画風・参照画像設定",
    "コマ画像生成",
    "作品管理",
    "PDF書き出し",
    "状況・ご意見",
  ]) {
    assert.match(dashboard, new RegExp(available));
  }
  assert.match(dashboard, /成人向け制作、販売申請、決済、収益管理は今回の先行利用対象外/);
  assert.match(dashboard, /先行販売購入者向け先行利用/);
  assert.match(dashboard, /利用設定・残りAI利用数・クレジット・安全確認/);
  assert.match(dashboard, /href="\/dashboard\/monitor\/guide"/);
});

test("ダッシュボードから漫画画像の品質確認へ直接移動できる", async () => {
  const dashboard = await read("../src/app/dashboard/page.tsx");

  assert.match(dashboard, /href="\/dashboard\/monitor\/quality-review"/);
  assert.match(dashboard, />品質確認<\/Link>/);
});

test("モニター報告は種類・影響度・環境を構造化して保存する", async () => {
  const [migration, page, repository] = await Promise.all([
    read("../supabase/migrations/202608030001_cloud_monitor_operations_hub.sql"),
    read("../src/app/dashboard/monitor/page.tsx"),
    read("../src/modules/general-monitor/infrastructure/monitor-feedback-repository.ts"),
  ]);
  for (const type of ["bug", "improvement", "feature_request"]) {
    assert.match(migration, new RegExp(type));
    assert.match(page, new RegExp(type));
  }
  assert.match(repository, /request_type/);
  assert.match(repository, /page_url/);
  assert.match(repository, /environment/);
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
  const [worker, workerAuth] = await Promise.all([
    read("../src/app/api/internal/monitor-ops/worker/route.ts"),
    read("../src/lib/internal-worker-auth.ts"),
  ]);
  assert.match(worker, /MANGAI_MONITOR_OPS_WORKER_SECRET/);
  assert.match(worker, /hasValidInternalWorkerAuthorization/);
  assert.match(workerAuth, /expected\.length < 32/);
  assert.match(workerAuth, /timingSafeEqual/);
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
