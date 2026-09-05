import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("モニター未登録を招待メール未完了と断定しない", async () => {
  const [dashboard, monitorPage, monitorPolicy] = await Promise.all([
    read("src/app/dashboard/page.tsx"),
    read("src/app/dashboard/monitor/page.tsx"),
    read("src/lib/cloud-general-monitor.ts"),
  ]);

  assert.doesNotMatch(dashboard, /招待が必要です/);
  assert.match(dashboard, /先行利用設定を確認/);
  assert.match(monitorPage, /招待メールの完了状況とは別に/);
  assert.match(monitorPolicy, /招待メールの完了状況とは別に利用枠の設定が必要です/);
});

test("AI画像生成対象外の作品には作成手順を案内する", async () => {
  const generation = await read("src/lib/cloud-panel-image-generation.ts");

  assert.match(generation, /AIシナリオからネームを採用し/);
  assert.match(generation, /そのネームから作成した本人の作品で実行してください/);
  assert.match(generation, /ownerProfileId !== input\.expectedOwnerProfileId/);
});
