import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("成人向け制作機能の一括許可は単一DB functionで全権限を更新する", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/202607300011_cloud_adult_workflow_bulk_grant.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /set_cloud_adult_research_entitlement/);
  for (const feature of [
    "adult_planning",
    "adult_ai_planning",
    "adult_scenario",
    "adult_storyboard",
  ])
    assert.match(sql, new RegExp(`'${feature}'`));
  assert.match(sql, /auth\.role\(\)<>'service_role'/);
  assert.match(
    sql,
    /revoke all on function public\.grant_cloud_adult_workflow_access[\s\S]+from public,anon,authenticated/,
  );
  assert.match(
    sql,
    /grant execute on function public\.grant_cloud_adult_workflow_access[\s\S]+to service_role/,
  );
});

test("管理画面は一括許可Actionだけを公開しClientから個別RPCを呼ばない", async () => {
  const [page, action] = await Promise.all([
    readFile(
      new URL("../src/app/admin/users/[id]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/users/[id]/adult-feature-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(page, /全工程を一括許可/);
  assert.match(action, /grant_cloud_adult_workflow_access/);
});
