import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const original = read("supabase/migrations/202607300005_cloud_storyboard_canvas_materialization.sql");
const forward = read("supabase/migrations/202610120001_cloud_storyboard_text_inner_region.sql");
const rollback = read("supabase/rollbacks/202610120001_cloud_storyboard_text_inner_region.sql");
const canonical = read("supabase/schema.sql");
const before = original.slice(original.indexOf("create or replace function public.build_cloud_storyboard_canvas("), original.indexOf("create or replace function public.materialize_cloud_storyboard_project(")).trim();

test("C3bは旧Builderを不変の内部helperに保持しrollbackで正確に復元する", () => {
  assert.ok(forward.includes(before.replaceAll("public.build_cloud_storyboard_canvas(", "public.build_cloud_storyboard_canvas_unfitted_v1(")));
  assert.ok(rollback.includes(before));
  assert.match(rollback, /drop function if exists public\.build_cloud_storyboard_canvas_unfitted_v1/);
  assert.doesNotMatch(forward, /\b(update|delete from|insert into)\s+public\./i);
  assert.doesNotMatch(forward, /enqueue_cloud_generation|cloud_ai_cost_ledger|cloud_assets/);
});

test("canonical schemaと追加migrationのBuilder契約が同一で再適用可能", () => {
  assert.ok(canonical.includes(forward.replace(/^begin;\s*/, "").replace(/\s*commit;\s*$/, "")));
  assert.match(forward, /v_font := 18/);
  assert.match(forward, /'\{textObjects\}',v_texts/);
  assert.match(forward, /from public,anon,authenticated,service_role/);
});

test("forward/reapplyとcanonicalのCIは実SQL領域・本文保持・ACLを検査", () => {
  for (const path of ["supabase/tests/assert_migrations.sql", "supabase/tests/assert_current_schema.sql"])
    assert.match(read(path), /\\ir assert_storyboard_text_region\.sql/);
  const sql = read("supabase/tests/assert_storyboard_text_region.sql");
  assert.match(sql, /array\[1,2,4,6\]/);
  assert.match(sql, /C3b truncated dialogue/);
  assert.match(sql, /has_function_privilege/);
});
