import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const runbook = fs.readFileSync(
  new URL("../docs/STAGING_DURABLE_EXPORT_ACCEPTANCE_RUNBOOK_20260826.md", import.meta.url),
  "utf8",
);

test("staging durable export受入れは環境取り違えと複数Project実行を拒否する", () => {
  assert.match(runbook, /MANGAI_DB_ENV=staging/);
  assert.match(runbook, /MANGAI_STAGING_PROJECT_REF.*PGHOST.*PGUSER/);
  assert.match(runbook, /Project 1件/);
  assert.match(runbook, /Production.*使用しない/);
});

test("3形式の中断再開・owner境界・cleanup・Flag復元を必須にする", () => {
  assert.match(runbook, /PDF.*PNG ZIP.*Project JSON/);
  assert.match(runbook, /完了済みsegmentを作り直さず/);
  assert.match(runbook, /owner A.*owner B/);
  assert.match(runbook, /cleanup/);
  assert.match(runbook, /queue 0/);
  assert.match(runbook, /既定OFFへ戻/);
});

test("外部Providerとcreditを受入れ範囲へ混在させない", () => {
  assert.match(runbook, /外部画像Provider、credit.*使用しない/);
  assert.match(runbook, /Production BFL受入れは別runbook/);
});
