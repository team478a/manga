import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Release 2からRelease 3への導線と履歴・修正・採用UIが存在する", async () => {
  const comparison = await readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/runs/[runId]/page.tsx", import.meta.url), "utf8");
  const list = await readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/scenario/page.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/page.tsx", import.meta.url), "utf8");
  assert.match(comparison, /シナリオ生成へ進む/);
  assert.match(list, /シナリオ版履歴/);
  assert.match(detail, /この版から修正版を作る/);
  assert.match(detail, /このシナリオを採用/);
  for (const source of [list, detail]) {
    assert.doesNotMatch(source, /min-w-\[/);
  }
});

test("scenario migrationは所有者RLSと企画・親版・採用版照合を強制する", async () => {
  const migration = await readFile(new URL("../supabase/migrations/202607300003_cloud_story_scenarios.sql", import.meta.url), "utf8");
  assert.match(migration, /alter table public\.cloud_story_scenario_versions enable row level security/);
  assert.match(migration, /alter table public\.cloud_story_scenario_adoptions enable row level security/);
  assert.match(migration, /selection\.research_report_id = research_report_id/);
  assert.match(migration, /parent\.proposal_selection_id = proposal_selection_id/);
  assert.match(migration, /version\.proposal_selection_id = proposal_selection_id/);
});
