import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("Release 3からRelease 4への導線と履歴・修正・採用UIが存在する", async () => {
  const scenario = await readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/page.tsx", import.meta.url), "utf8");
  const list = await readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/page.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/versions/[storyboardVersionId]/page.tsx", import.meta.url), "utf8");
  assert.match(scenario, /AIネーム生成へ進む/);
  assert.match(list, /ネーム版履歴/);
  assert.match(detail, /この版から修正版を作る/);
  assert.match(detail, /このネームを採用/);
  assert.doesNotMatch(detail, /min-w-\[/);
});
test("storyboard migrationは現在採用シナリオと所有者RLSを強制する", async () => {
  const migration = await readFile(new URL("../supabase/migrations/202607300004_cloud_story_storyboards.sql", import.meta.url), "utf8");
  assert.match(migration, /alter table public\.cloud_story_storyboard_versions enable row level security/);
  assert.match(migration, /alter table public\.cloud_story_storyboard_adoptions enable row level security/);
  assert.match(migration, /not exists\(/);
  assert.match(migration, /newer\.proposal_selection_id=adoption\.proposal_selection_id/);
});
test("ネーム画面は内部詳細を露出しない専用error状態を持つ", async () => {
  const source = await readFile(new URL("../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/error.tsx", import.meta.url), "utf8");
  assert.match(source, /ネームを表示できませんでした/);
  assert.match(source, /内部エラーの詳細は表示していません/);
});
test("採用版の取得順は同一時刻でもUUIDで確定する", async () => {
  const storyboardServer = await readFile(new URL("../src/lib/cloud-storyboard-server.ts", import.meta.url), "utf8");
  const scenarioServer = await readFile(new URL("../src/lib/cloud-scenario-server.ts", import.meta.url), "utf8");
  assert.match(storyboardServer, /order\("adopted_at".+order\("id"/);
  assert.match(scenarioServer, /order\("adopted_at".+order\("id"/);
});
