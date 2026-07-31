import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const editor = fs.readFileSync(
  "src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx",
  "utf8",
);
const route = fs.readFileSync(
  "src/app/api/creator/storyboard-panel-generation/route.ts",
  "utf8",
);
const service = fs.readFileSync(
  "src/lib/cloud-panel-image-generation-server.ts",
  "utf8",
);
const generationService = fs.readFileSync(
  "src/modules/cloud-creator/generation/generation-service.ts",
  "utf8",
);

test("Canvasは選択コマからAIおまかせ生成と対象コマ配置を提供する", () => {
  assert.match(editor, /AIおまかせ画像生成/);
  assert.match(editor, /選択したコマを生成/);
  assert.match(editor, /生成対象のコマへ配置/);
  assert.match(editor, /target_panel_id/);
});

test("専用Routeも既存rate limitとAPI Error契約を通る", () => {
  assert.match(route, /enforceCloudAiRateLimit/);
  assert.match(route, /enqueueStoryboardPanelImage/);
  assert.match(route, /toApiError/);
  assert.ok(
    route.indexOf("cloudPanelImageGenerationFeatureEnabled()") <
      route.indexOf("await enforceCloudAiRateLimit(request)"),
  );
});

test("Feature Flagは認証・DB・Providerより前にfail closedする", () => {
  const flag = service.indexOf("cloudPanelImageGenerationFeatureEnabled()");
  assert.ok(flag >= 0);
  assert.ok(flag < service.indexOf("cloudCreatorContext()"));
  assert.ok(flag < service.lastIndexOf("await enqueueCloudGenerationJob("));
});

test("生成PromptはJob一覧responseから除外し対象panel IDだけを返す", () => {
  assert.match(generationService, /input: _privateInput/);
  assert.match(generationService, /target_panel_id: targetPanelId/);
  assert.doesNotMatch(editor, /job\.input|generation\.prompt/);
});

test("Release 6追加UIは固定横幅を導入しない", () => {
  const smartGenerationStart = editor.indexOf("AIおまかせ画像生成");
  const manualGenerationStart = editor.indexOf(
    'htmlFor="cloud-generation-type"',
  );
  const smartGenerationUi = editor.slice(
    smartGenerationStart,
    manualGenerationStart,
  );

  assert.ok(smartGenerationStart >= 0);
  assert.ok(manualGenerationStart > smartGenerationStart);
  assert.doesNotMatch(
    smartGenerationUi,
    /min-w-\[|(?:^|[\s"'`])w-\[[1-9][0-9]{3,}px\]/,
  );
});
