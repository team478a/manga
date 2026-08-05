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
  "src/modules/manga/application/enqueue-panel-candidates.ts",
  "utf8",
);
const generationService = fs.readFileSync(
  "src/modules/cloud-creator/generation/generation-service.ts",
  "utf8",
);
const inpaintingDialog = fs.readFileSync(
  "src/app/creator/[projectId]/pages/[pageId]/PanelInpaintingDialog.tsx",
  "utf8",
);
const comparisonDialog = fs.readFileSync(
  "src/app/creator/[projectId]/pages/[pageId]/PanelImageComparisonDialog.tsx",
  "utf8",
);
const candidateDomain = fs.readFileSync(
  "src/modules/manga/domain/panel-candidate.ts",
  "utf8",
);
const adoptionDomain = fs.readFileSync(
  "src/modules/manga/domain/panel-adoption.ts",
  "utf8",
);

test("Canvasは選択コマからAIおまかせ生成と対象コマ配置を提供する", () => {
  assert.match(editor, /AIおまかせ画像生成/);
  assert.match(editor, /生成する候補数/);
  assert.match(editor, /3案（おすすめ）/);
  assert.match(editor, /この候補を採用してコマへ配置/);
  assert.match(editor, /このコマだけ再実行/);
  assert.match(editor, /生成されたコマ候補/);
  assert.match(editor, /target_panel_id/);
  assert.match(editor, /画像生成を受付中…/);
  assert.match(editor, /requestingPanelGeneration/);
});

test("Canvasは画角・カメラ・人物配置・視線を選んで通常生成だけへ送る", () => {
  assert.match(editor, /画角・ポーズを調整（任意）/);
  assert.match(editor, /カメラ位置/);
  assert.match(editor, /人物配置/);
  assert.match(editor, /視線方向/);
  assert.match(editor, /全身・ポーズ/);
  assert.match(editor, /二人を並べる/);
  assert.match(editor, /shotOverride,/);
  assert.match(editor, /cameraAngleOverride,/);
  assert.match(editor, /subjectPlacement,/);
  assert.match(editor, /gazeDirection,/);
  assert.match(service, /compositionControl/);
});

test("Canvasは完成コマ・背景・人物・効果を分けて生成し別レイヤーへ採用する", () => {
  assert.match(editor, /生成するレイヤー/);
  assert.match(editor, /完成コマ（背景・人物・効果）/);
  assert.match(editor, /背景だけ/);
  assert.match(editor, /人物だけ/);
  assert.match(editor, /効果だけ/);
  assert.match(editor, /generationTarget: panelGenerationTarget/);
  assert.match(adoptionDomain, /AI人物レイヤー/);
  assert.match(adoptionDomain, /AI効果レイヤー/);
  assert.match(adoptionDomain, /adoption\.layerType === "character"/);
  assert.match(adoptionDomain, /\? "multiply"/);
  assert.match(service, /generationTarget: request\.generationTarget/);
});

test("Canvasは採用画像を残したまま部位別の修正候補を生成する", () => {
  assert.match(editor, /採用画像の気になる部分を直す/);
  assert.match(editor, /顔の崩れを直す/);
  assert.match(editor, /手・指の崩れを直す/);
  assert.match(editor, /衣装を設定に合わせる/);
  assert.match(editor, /元画像はレイヤーに残る/);
  assert.match(editor, /sourceAssetId: selectedRevisionLayer/);
  assert.match(editor, /直す範囲を塗って部分修正/);
  assert.match(editor, /maskAssetId: maskAsset\.id/);
});

test("Canvasは方向を選び採用画像を残したまま画角拡張候補を生成する", () => {
  assert.match(editor, /画角を広げる方向/);
  assert.match(editor, /左側/);
  assert.match(editor, /右側/);
  assert.match(editor, /上側/);
  assert.match(editor, /下側/);
  assert.match(editor, /全方向/);
  assert.match(editor, /画角を広げた候補を/);
  assert.match(editor, /outpaintingDirection/);
  assert.match(editor, /requestPanelOutpainting/);
  assert.match(candidateDomain, /job\.generation_operation === "outpainting"/);
  assert.match(candidateDomain, /return "correction"/);
});

test("修正候補は修正前との比較スライダーから採用できる", () => {
  assert.match(editor, /修正前と比較/);
  assert.match(editor, /source_asset_id/);
  assert.match(editor, /outpainting_direction/);
  assert.match(editor, /PanelImageComparisonDialog/);
  assert.match(comparisonDialog, /修正前と候補を比較/);
  assert.match(comparisonDialog, /type="range"/);
  assert.match(comparisonDialog, /比較位置/);
  assert.match(comparisonDialog, /この候補を採用/);
  assert.match(comparisonDialog, /resolveComparisonSourceFrame/);
});

test("部分修正UIは白く塗った範囲を同寸法PNGマスクとして送る", () => {
  assert.match(inpaintingDialog, /直したい範囲を塗る/);
  assert.match(inpaintingDialog, /黒い範囲は元画像を維持/);
  assert.match(inpaintingDialog, /destination-out/);
  assert.match(inpaintingDialog, /fillStyle = "#000000"/);
  assert.match(inpaintingDialog, /drawImage\(strokes/);
  assert.match(inpaintingDialog, /image\/png/);
});

test("部分修正UIは修正内容に合う範囲を自動配置して手動調整も残す", () => {
  assert.match(inpaintingDialog, /修正範囲のおすすめ/);
  assert.match(inpaintingDialog, /defaultMaskSuggestion/);
  assert.match(inpaintingDialog, /paintSuggestion/);
  assert.match(inpaintingDialog, /画像を見ながら「塗る」「消す」で調整/);
  assert.match(editor, /revisionPreset=\{revisionPreset\}/);
});

test("専用Serviceは修正元Assetの所有権と選択コマへの配置を検証する", () => {
  assert.match(service, /layer\.panelId === request\.panelId/);
  assert.match(service, /layer\.assetId === revision\.sourceAssetId/);
  assert.match(service, /\.eq\("owner_profile_id", profile\.id\)/);
  assert.match(service, /この画像を修正元として利用できません/);
  assert.match(service, /maskAsset\.data\.width !== sourceAsset\.data\.width/);
  assert.match(service, /maskAsset\.data\.mime_type !== "image\/png"/);
});

test("専用Serviceは同じコマの複数候補を別Jobとして登録する", () => {
  assert.match(service, /request\.candidateCount/);
  assert.match(service, /candidateIndex/);
  assert.match(service, /:candidate:/);
  assert.match(service, /partial/);
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
  const inpaintingFlag = service.indexOf("cloudPanelInpaintingFeatureEnabled()");
  assert.ok(inpaintingFlag > flag);
  assert.ok(inpaintingFlag < service.indexOf("cloudCreatorContext()"));
  const outpaintingFlag = service.indexOf("cloudPanelOutpaintingFeatureEnabled()");
  assert.ok(outpaintingFlag > flag);
  assert.ok(outpaintingFlag < service.indexOf("cloudCreatorContext()"));
});

test("生成PromptはJob一覧responseから除外し対象panel IDだけを返す", () => {
  assert.match(generationService, /input: _privateInput/);
  assert.match(generationService, /target_panel_id: targetPanelId/);
  assert.match(generationService, /revision_preset: revisionPreset/);
  assert.match(generationService, /generation_operation: generationOperation/);
  assert.match(generationService, /source_asset_id: sourceAssetId/);
  assert.match(generationService, /outpainting_direction: outpaintingDirection/);
  assert.match(generationService, /"outpainting"/);
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
