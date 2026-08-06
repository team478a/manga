import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("production migration provides review states and durable finalization", () => {
  const sql = read("supabase/migrations/202608010005_cloud_production_status.sql");
  assert.match(sql, /'not_started','generating','review_required','revision_required','finalized'/);
  assert.match(sql, /cloud_page_finalize_active_jobs/);
  assert.match(sql, /if v_page\.production_status='finalized' then raise exception 'cloud_page_finalized'/);
  assert.match(sql, /production_context_revision=production_context_revision\+1/);
  assert.match(sql, /cloud_generation_job_page_status/);
});

test("status service fails safely before migration and hides database errors", () => {
  const service = read("src/modules/cloud-creator/production/production-status-service.ts");
  const policy = read("src/modules/manga/domain/production-state.ts");
  assert.match(service, /error\?\.code === "42703"/);
  assert.match(service, /ページの制作状況を読み込めませんでした/);
  assert.match(service, /buildPageProductionStates/);
  assert.match(policy, /status === "finalized" && reviewed != null && reviewed < contextRevision/);
});

test("production board exposes progress filters review and reopen controls", () => {
  const component = read("src/app/creator/[projectId]/LongformPageManager.tsx");
  assert.match(component, /完成進捗/);
  assert.match(component, /確認が必要/);
  assert.match(component, /設定変更あり/);
  assert.match(component, /編集ロック中/);
  assert.match(component, /編集を再開/);
  assert.match(component, /disabled=\{statusOf\(page\.id\) === "finalized"\}/);
});

test("batch generation rejects finalized pages before queue creation", () => {
  const service = read("src/modules/cloud-creator/generation/batch-production-service.ts");
  assert.match(service, /select\("id,production_status"\)/);
  assert.match(service, /production_status === "finalized"/);
  assert.match(service, /確定済みページは一括生成できません/);
});
