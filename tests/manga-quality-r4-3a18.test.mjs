import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("裁定migrationは既存回答を変更せず専用tableと有効case一意制約を追加する", async () => {
  const migration = await read("../supabase/migrations/202609140003_cloud_monitor_quality_review_adjudication.sql");
  assert.match(migration, /create table if not exists public\.cloud_monitor_quality_review_adjudications/);
  assert.match(migration, /create table if not exists public\.cloud_monitor_quality_review_adjudication_events/);
  assert.match(migration, /where status<>'revoked'/);
  assert.match(migration, /foreign key\(case_id,batch_id\)/);
  assert.doesNotMatch(migration, /update public\.cloud_monitor_quality_review_responses/);
  assert.doesNotMatch(migration, /delete from public\.cloud_monitor_quality_review_(responses|assignments|cases)/);
});

test("割り当ては完了Batch・Primary確定不一致・第三者・管理者をDBでも必須にする", async () => {
  const migration = await read("../supabase/migrations/202609140003_cloud_monitor_quality_review_adjudication.sql");
  assert.match(migration, /v_batch_status is distinct from 'completed'/);
  assert.match(migration, /reviewer_slot='reviewer_a'/);
  assert.match(migration, /reviewer_slot='reviewer_b'/);
  assert.match(migration, /v_signature_a=v_signature_b/);
  assert.match(migration, /monitor_quality_review_adjudication_not_required/);
  assert.match(migration, /new\.adjudicator_profile_id in\(v_primary_a,v_primary_b\)/);
  assert.match(migration, /assigned_by_profile_id and role='admin'/);
  assert.match(migration, /auth\.role\(\)<>'service_role'/);
});

test("裁定者RPCはBlind-first順序・本人・source fingerprint・idempotencyを守る", async () => {
  const migration = await read("../supabase/migrations/202609140003_cloud_monitor_quality_review_adjudication.sql");
  assert.match(migration, /status='in_progress' and consented_at is not null/);
  assert.match(migration, /status='independent_locked'.*differences_revealed_at is not null/s);
  assert.match(migration, /adjudicator_profile_id=v_profile/g);
  assert.match(migration, /monitor_quality_review_adjudication_source_changed/g);
  assert.match(migration, /idempotency_key ~ '\^\[A-Za-z0-9_\-\]\{16,120\}\$'/);
  assert.match(migration, /on conflict\(adjudication_id,event_type,idempotency_key\) do nothing/);
  assert.match(migration, /monitor_quality_review_adjudication_submitted_immutable/);
  assert.match(migration, /monitor_quality_review_adjudication_independent_immutable/);
});

test("A/B差分開示はverdict・category・severityだけを返し自由記述と個人IDを返さない", async () => {
  const migration = await read("../supabase/migrations/202609140003_cloud_monitor_quality_review_adjudication.sql");
  const reveal = migration.slice(
    migration.indexOf("create or replace function public.reveal_cloud_monitor_quality_review_adjudication_differences"),
    migration.indexOf("create or replace function public.submit_cloud_monitor_quality_review_adjudication"),
  );
  assert.match(reveal, /'verdict'/);
  assert.match(reveal, /'category'/);
  assert.match(reveal, /'severity'/);
  assert.doesNotMatch(reveal, /overall_comment|reviewer_profile_id|display_name|email/);
});

test("table直接アクセスを閉じ、本人RPCと管理RPCの権限を分離する", async () => {
  const migration = await read("../supabase/migrations/202609140003_cloud_monitor_quality_review_adjudication.sql");
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all on public\.cloud_monitor_quality_review_adjudications[\s\S]*from public,anon,authenticated/);
  assert.match(migration, /grant select,insert,update on public\.cloud_monitor_quality_review_adjudications to service_role/);
  assert.match(migration, /assign_cloud_monitor_quality_review_adjudication[\s\S]*to service_role/);
  assert.match(migration, /consent_cloud_monitor_quality_review_adjudication[\s\S]*to authenticated,service_role/);
  assert.doesNotMatch(migration, /grant (select|insert|update|delete) on public\.cloud_monitor_quality_review_adjudications to authenticated/);
});

test("監査eventは回答本文を持たずappend-onlyである", async () => {
  const migration = await read("../supabase/migrations/202609140003_cloud_monitor_quality_review_adjudication.sql");
  const events = migration.slice(
    migration.indexOf("create table if not exists public.cloud_monitor_quality_review_adjudication_events"),
    migration.indexOf("create index if not exists cloud_monitor_quality_review_adjudication_events_case_idx"),
  );
  assert.match(events, /event_type text not null/);
  assert.match(events, /idempotency_key text not null/);
  assert.doesNotMatch(events, /payload|comment|email|prompt|image/);
  assert.match(migration, /before update or delete on public\.cloud_monitor_quality_review_adjudication_events/);
  assert.match(migration, /monitor_quality_review_adjudication_events_append_only/);
});

test("rollbackは保存済み裁定を削除せず空tableだけを戻す", async () => {
  const rollback = await read("../supabase/rollbacks/202609140003_cloud_monitor_quality_review_adjudication.sql");
  assert.match(rollback, /monitor_quality_review_adjudication_rollback_requires_empty_tables/);
  assert.match(rollback, /drop table if exists public\.cloud_monitor_quality_review_adjudication_events/);
  assert.match(rollback, /drop table if exists public\.cloud_monitor_quality_review_adjudications/);
  assert.doesNotMatch(rollback, /delete from|truncate/);
});

test("canonical schemaにも裁定table・RPC・append-only guardを含める", async () => {
  const schema = await read("../supabase/schema.sql");
  assert.match(schema, /cloud_monitor_quality_review_adjudications/);
  assert.match(schema, /assign_cloud_monitor_quality_review_adjudication/);
  assert.match(schema, /reveal_cloud_monitor_quality_review_adjudication_differences/);
  assert.match(schema, /monitor_quality_review_adjudication_events_append_only/);
});
