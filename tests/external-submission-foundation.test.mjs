import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("外部作品申請基盤は一般向け・招待seller・非公開状態機械に限定する", async () => {
  const [migration, schema] = await Promise.all([
    read("supabase/migrations/202610100001_external_submission_foundation.sql"),
    read("supabase/schema.sql"),
  ]);

  for (const source of [migration, schema]) {
    assert.match(source, /create table if not exists public\.external_seller_profiles/);
    assert.match(source, /status[^;]+(?:'draft'[^;]+'eligible'[^;]+'suspended')/s);
    assert.match(source, /create table if not exists public\.external_work_submissions/);
    assert.match(source, /content_class[^;]+check\s*\(content_class\s*=\s*'general'\)/s);
    assert.match(source, /source_format[^;]+(?:'pdf'[^;]+'zip'[^;]+'images')/s);
    assert.match(source, /external_seller_not_eligible/);
    assert.match(source, /external_rights_declaration_required/);
    assert.match(source, /external_submission_transition_forbidden/);
    const externalSection = source.slice(
      source.indexOf("create table if not exists public.external_seller_profiles"),
    );
    assert.doesNotMatch(externalSection, /insert into public\.works/);
    assert.doesNotMatch(externalSection, /insert into public\.digital_products/);
  }
});

test("外部作品申請の権利申告と監査eventは追記専用で本文・秘密値を持たない", async () => {
  const [migration, rollback] = await Promise.all([
    read("supabase/migrations/202610100001_external_submission_foundation.sql"),
    read("supabase/rollbacks/202610100001_external_submission_foundation.sql"),
  ]);

  assert.match(migration, /create table if not exists public\.external_work_rights_declarations/);
  assert.match(migration, /rights_holder_confirmed boolean not null/);
  assert.match(migration, /third_party_permissions_confirmed boolean not null/);
  assert.match(migration, /ai_use_disclosed boolean not null/);
  assert.match(migration, /adult_content_absent boolean not null/);
  assert.match(migration, /external_submission_audit_append_only/);
  assert.match(migration, /before update or delete on public\.external_work_rights_declarations/);
  assert.match(migration, /before update or delete on public\.external_work_submission_events/);
  assert.doesNotMatch(
    migration,
    /external_work_submission_events[\s\S]{0,900}(?:prompt|email|token|secret|image|response_body)/i,
  );
  assert.match(rollback, /external_submission_foundation_rollback_requires_empty_tables/);
});

test("外部作品申請tableは本人readだけを許可し更新は検証付きRPCへ閉じる", async () => {
  const migration = await read(
    "supabase/migrations/202610100001_external_submission_foundation.sql",
  );

  assert.match(migration, /external_work_submissions_owner_read/);
  assert.match(migration, /owner_profile_id\s*=\s*public\.current_profile_id\(\)/);
  assert.match(
    migration,
    /revoke all on public\.external_seller_profiles,[\s\S]+from public,anon,authenticated,service_role/,
  );
  assert.match(
    migration,
    /grant select on public\.external_seller_profiles,[\s\S]+to authenticated,service_role/,
  );
  assert.doesNotMatch(
    migration,
    /grant[^;]*(?:insert|update|delete)[^;]*external_work_submissions[^;]*to (?:authenticated|service_role)/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.create_external_work_submission\(text,text,text,text\) to authenticated/,
  );
  assert.match(
    migration,
    /revoke all on function public\.create_external_work_submission\(text,text,text,text\)[\s\S]+from public,anon,authenticated,service_role/,
  );
});

test("submission送信は最新の完全な権利申告とeligible sellerを必須にする", async () => {
  const migration = await read(
    "supabase/migrations/202610100001_external_submission_foundation.sql",
  );
  const transition = migration.slice(
    migration.indexOf("create or replace function public.transition_external_work_submission"),
  );

  assert.match(transition, /seller\.status='eligible'/);
  assert.match(transition, /order by declaration\.created_at desc,declaration\.id desc/);
  assert.match(transition, /latest\.rights_holder_confirmed/);
  assert.match(transition, /latest\.third_party_permissions_confirmed/);
  assert.match(transition, /latest\.ai_use_disclosed/);
  assert.match(transition, /latest\.adult_content_absent/);
  assert.match(transition, /v_submission\.status='draft' and p_status='uploading'/);
  assert.doesNotMatch(
    transition,
    /v_submission\.status='draft'[^;]+p_status='(?:approved|published)'/,
  );
});
