import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("管理者生成品質migrationは生成済み画像だけを判定し監査する", async () => {
  const sql = await read(
    "supabase/migrations/202609180001_cloud_admin_generation_quality_reviews.sql",
  );
  assert.match(sql, /cloud_admin_generation_quality_reviews/);
  assert.match(sql, /approved','needs_review','quality_issue/);
  assert.match(sql, /public\.is_admin\(\)/);
  assert.match(sql, /v_job\.kind<>'image'/);
  assert.match(sql, /v_job\.status<>'completed'/);
  assert.match(sql, /asset\.source_generation_job_id=v_job\.id/);
  assert.match(sql, /generation_quality_reviewed/);
  assert.doesNotMatch(sql, /prompt_sha256/);
});

test("管理者生成品質rollbackは実データを暗黙削除しない", async () => {
  const sql = await read(
    "supabase/rollbacks/202609180001_cloud_admin_generation_quality_reviews.sql",
  );
  assert.match(sql, /rollback_requires_empty_table/);
  assert.match(
    sql,
    /drop function if exists public\.review_cloud_admin_generation_quality/,
  );
});

test("生成品質repositoryは生成Assetだけへ短時間署名URLを発行する", async () => {
  const source = await read(
    "src/modules/manga-quality/infrastructure/admin-generation-quality-repository.ts",
  );
  assert.match(source, /\.eq\("kind", "image"\)/);
  assert.match(source, /\.eq\("status", "completed"\)/);
  assert.match(source, /source_generation_job_id/);
  assert.match(source, /source_generation_job_id\) === String\(job\.id\)/);
  assert.match(
    source,
    /from\("cloud-assets"\)\s*\.createSignedUrls\(paths, 300\)/,
  );
  assert.doesNotMatch(source, /input,prompt|prompt_sha256/);
});

test("生成品質画面は未完成・未採用候補を含めて絞り込みと判定を提供する", async () => {
  const [page, action, dashboard] = await Promise.all([
    read("src/app/admin/generation-quality/page.tsx"),
    read("src/app/admin/generation-quality/actions.ts"),
    read("src/app/admin/page.tsx"),
  ]);
  assert.match(page, /完成・公開状態に関係なく/);
  assert.match(page, /未採用候補/);
  assert.match(page, /管理者判定/);
  assert.match(page, /自動検査/);
  assert.doesNotMatch(page, /productionStatus === "finalized"/);
  assert.match(action, /requireAdmin\(\)/);
  assert.match(action, /reviewAdminGenerationQualityAction/);
  assert.match(dashboard, /\/admin\/generation-quality/);
});
