import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("src/app/creator/[projectId]/page.tsx", "utf8");
const characterService = fs.readFileSync(
  "src/modules/cloud-creator/projects/character-sheet-service.ts",
  "utf8",
);
const progressService = fs.readFileSync(
  "src/modules/cloud-creator/projects/manuscript-preflight-service.ts",
  "utf8",
);
const generationServer = fs.readFileSync(
  "src/modules/manga/application/enqueue-panel-candidates.ts",
  "utf8",
);

test("作品画面でキャラクター設定とページ別生成進捗を案内する", () => {
  assert.match(page, /キャラクター設定表/);
  assert.match(page, /作品全体の生成進捗/);
  assert.match(page, /画像配置完了/);
  assert.match(page, /販売原稿としての完成判定は原稿プレビューで確認してください/);
  assert.match(page, /画像配置/);
  assert.match(page, /再実行が必要/);
});

test("キャラクター設定は本人の既存制作経路から読み、秘密権限を使わない", () => {
  assert.match(characterService, /cloud_story_storyboard_projects/);
  assert.match(characterService, /cloud_story_scenario_versions/);
  assert.match(characterService, /cloudStoryScenarioResultSchema\.safeParse/);
  assert.doesNotMatch(characterService, /service_role|createClient/);
});

test("生成進捗と人物設定をProvider条件へ接続する", () => {
  assert.match(progressService, /cloud_generation_jobs/);
  assert.match(progressService, /\.limit\(1000\)/);
  assert.match(generationServer, /characterProfiles/);
  assert.doesNotMatch(generationServer, /service_role/);
});
