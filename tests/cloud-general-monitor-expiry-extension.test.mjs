import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("期限延長RPCは利用条件を保持し短縮と権限外実行を拒否する", async () => {
  const migration = await read("supabase/migrations/202609240001_cloud_general_monitor_expiry_extension.sql");
  const extension = migration.slice(
    migration.indexOf("create or replace function public.extend_cloud_general_monitor_expiry"),
    migration.indexOf("create or replace function public.record_cloud_general_monitor_expiry_email_sent"),
  );
  assert.match(extension, /auth\.role\(\)<>'service_role'/);
  assert.match(extension, /role='admin'/);
  assert.match(extension, /for update/);
  assert.match(extension, /cloud_general_monitor_not_active/);
  assert.match(extension, /p_expires_at<=v_before\.starts_at/);
  assert.match(extension, /cloud_general_monitor_expiry_must_not_shorten/);
  assert.match(extension, /if p_expires_at=v_before\.expires_at then/);
  assert.match(extension, /changed:=false/);
  assert.match(extension, /set expires_at=p_expires_at,updated_at=now\(\)/);
  assert.doesNotMatch(extension, /set[^;]*(ai_requests_used|ai_request_limit|starts_at|cohort|status)\s*=/);
  assert.match(extension, /'extend_expiry'/);
  assert.match(extension, /operation_note/);
  assert.match(extension, /to service_role/);
});

test("期限延長メール監査は同じ対象と期限の重複記録を防ぐ", async () => {
  const migration = await read("supabase/migrations/202609240001_cloud_general_monitor_expiry_extension.sql");
  const notification = migration.slice(
    migration.indexOf("create or replace function public.record_cloud_general_monitor_expiry_email_sent"),
  );
  assert.match(notification, /for update/);
  assert.match(notification, /v_enrollment\.expires_at<>p_expires_at/);
  assert.match(notification, /action='expiry_extension_email_sent'/);
  assert.match(notification, /after_value->>'expires_at'/);
  assert.match(notification, /then return false/);
  assert.match(notification, /from public,anon,authenticated/);
});

test("rollbackとschemaは期限延長RPC・監査actionと同期している", async () => {
  const [rollback, schema] = await Promise.all([
    read("supabase/rollbacks/202609240001_cloud_general_monitor_expiry_extension.sql"),
    read("supabase/schema.sql"),
  ]);
  assert.match(rollback, /drop function if exists public\.record_cloud_general_monitor_expiry_email_sent/);
  assert.match(rollback, /drop function if exists public\.extend_cloud_general_monitor_expiry/);
  assert.match(rollback, /delete from public\.cloud_general_monitor_audit_logs/);
  assert.match(schema, /extend_cloud_general_monitor_expiry/);
  assert.match(schema, /record_cloud_general_monitor_expiry_email_sent/);
  assert.match(schema, /'extend_expiry','expiry_extension_email_sent'/);
});

test("管理画面は既存active利用者に期限専用操作と明示確認を表示する", async () => {
  const [page, form, action, repository] = await Promise.all([
    read("src/app/admin/users/[id]/page.tsx"),
    read("src/app/admin/users/[id]/MonitorExpiryExtensionForm.tsx"),
    read("src/app/admin/users/[id]/general-monitor-actions.ts"),
    read("src/modules/general-monitor/infrastructure/admin-monitor-repository.ts"),
  ]);
  assert.match(page, /generalMonitor\?\.status === "active"/);
  assert.match(page, /MonitorExpiryExtensionForm/);
  assert.match(form, /期限だけを延長/);
  assert.match(form, /AI利用数・利用上限・開始日・グループは保持します/);
  assert.match(form, /window\.confirm/);
  assert.match(form, /name="notify"/);
  assert.doesNotMatch(form, /defaultChecked/);
  assert.match(action, /extendGeneralMonitorExpiry/);
  assert.match(action, /new Date\(`\$\{parsed\.data\.expiresAt\}\+09:00`\)/);
  assert.match(action, /parsed\.data\.notify/);
  assert.match(action, /sendCloudGeneralMonitorExpiryExtendedEmail/);
  assert.match(action, /recordGeneralMonitorExpiryNotification/);
  assert.match(repository, /"extend_cloud_general_monitor_expiry"/);
  assert.match(repository, /"record_cloud_general_monitor_expiry_email_sent"/);
});
