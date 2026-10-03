import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const projectPage = read("src/app/creator/[projectId]/page.tsx");
const journey = read("src/app/creator/[projectId]/CloudCreationJourney.tsx");
const readiness = read(
  "src/app/creator/[projectId]/LongformReadinessPanel.tsx",
);
const editor = read(
  "src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx",
);

test("作品画面は現在の目的を1件だけ示し、全工程を必要時に展開する", () => {
  assert.match(projectPage, /CloudCreationJourney/);
  assert.match(projectPage, /id="project-structure"/);
  assert.match(projectPage, /id="project-details"/);
  assert.match(journey, /今やること：/);
  assert.match(journey, /構成を作る/);
  assert.match(journey, /原稿を仕上げる/);
  assert.match(journey, /完成版を固定する/);
  assert.match(journey, /完成原稿を出力する/);
  assert.match(journey, /販売を準備する/);
  assert.match(journey, /全体の流れと完了状況を見る/);
});

test("長編の安全確認は現在項目を優先し、全4段階を折りたたむ", () => {
  assert.match(readiness, /現在の確認項目/);
  assert.match(readiness, /安全な完成・復旧の全4段階を見る/);
  assert.match(readiness, /<details/);
});

test("原稿編集は基本手順を案内し、AI操作を詳細領域へ分離する", () => {
  assert.match(editor, /基本の制作手順/);
  assert.match(editor, /今やること：/);
  assert.match(editor, /コマ・画像・文字・保存の順番を見る/);
  assert.match(editor, /id="page-layout-tools"/);
  assert.match(editor, /id="page-image-assets"/);
  assert.match(editor, /id="page-completion-status"/);
  assert.match(editor, /AI制作アシスト（creditを使う詳細操作）/);
  assert.match(
    editor,
    /<details className="panel p-4" id="panel-generation-controls">/,
  );
  assert.match(editor, /generationControls instanceof HTMLDetailsElement/);
});
