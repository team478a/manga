import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("quality feedback persists only after caller-scoped ownership checks", () => {
  const route = read("src/app/api/creator/quality-feedback/route.ts");
  const repository = read(
    "src/modules/general-monitor/infrastructure/quality-feedback-repository.ts",
  );
  assert.match(route, /getCloudPageSnapshot\(input\.pageId\)/);
  assert.match(route, /snapshot\.project_id !== input\.projectId/);
  assert.match(route, /saveMonitorQualityFeedback\(/);
  assert.doesNotMatch(route, /createClient\(\)/);
  assert.doesNotMatch(route, /createAdminClient\(\)/);
  assert.ok(
    route.indexOf("getCloudPageSnapshot(input.pageId)") <
      route.indexOf("saveMonitorQualityFeedback({"),
  );
  assert.match(repository, /createAdminClient\(\)/);
  assert.match(repository, /legacyQualityFeedbackComment/);
});

test("blank name pages explain that image generation has not started", () => {
  const editor = read(
    "src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx",
  );
  const notice = read(
    "src/app/creator/[projectId]/pages/[pageId]/CanvasImageGenerationNotice.tsx",
  );
  const manager = read(
    "src/app/creator/[projectId]/LongformPageManager.tsx",
  );
  assert.match(editor, /<CanvasImageGenerationNotice/);
  assert.match(notice, /このページはまだ画像生成前です/);
  assert.match(notice, /完成原稿画像ではありません/);
  assert.match(notice, /href=\{`\/creator\/\$\{projectId\}#page-generation`\}/);
  assert.match(manager, /id="page-generation"/);
  assert.match(manager, /次に行う操作/);
  assert.match(manager, /画像生成するページを選ぶ/);
  assert.match(manager, /1\. ページを選択/);
  assert.match(manager, /2\. 見積りを確認/);
  assert.match(manager, /3\. 紫のボタンで開始/);
  assert.match(manager, /まだページが選択されていません/);
});

test("page generation gives an explicit recovery path for invalid selection", () => {
  const manager = read(
    "src/app/creator/[projectId]/LongformPageManager.tsx",
  );
  assert.match(manager, /あと1ページ必要です/);
  assert.match(manager, /ページも選ぶ/);
  assert.match(manager, /選択した2ページが連続していません/);
  assert.match(manager, /3ページでは開始できません/);
  assert.match(manager, /表示中の停止理由を解消してください/);
  assert.match(manager, /page-generation-selection-status/);
});

test("disabled submit is distinct from an in-progress submit", () => {
  const button = read("src/components/PendingSubmitButton.tsx");
  assert.match(button, /pending\s*\?\s*"cursor-wait opacity-70"/);
  assert.match(button, /disabled\s*\?\s*"cursor-not-allowed opacity-60"/);
  assert.doesNotMatch(button, /disabled:cursor-wait/);
});
