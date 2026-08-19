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
  assert.match(repository, /coreStructuredError/);
  assert.ok(
    repository.indexOf("target_scope: input.targetScope") <
      repository.indexOf("legacyQualityFeedbackComment({"),
  );
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
});
