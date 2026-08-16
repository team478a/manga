import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("対話型の失敗コマ再実行は失敗Jobの保存済み入力を所有者境界内で復元する", () => {
  const service = read("src/modules/cloud-creator/generation/interactive-retry-service.ts");
  assert.match(service, /retryFailedInteractiveCloudGenerationJob/);
  assert.match(service, /status,input,error_code,provider_job_id/);
  assert.match(service, /cloudGenerationInputSchema\.safeParse/);
  assert.match(service, /parsedGeneration\.data\.targetPanelId/);
  assert.match(service, /buildGeneralAudienceGenerationRetry/);
  assert.match(service, /buildConservativeGeneralAudienceGenerationRetry/);
  assert.match(service, /isGeneralAudienceGenerationRetry/);
  assert.match(service, /isConservativeGeneralAudienceGenerationRetry/);
  assert.match(service, /consumeCloudGeneralMonitorAiRequest/);
  assert.match(service, /savePanelSpecification/);
  assert.doesNotMatch(service, /replace_cloud_generation_batch_job/);
});

test("専用APIは既存rate limitとAPI Error契約を維持する", () => {
  const route = read("src/modules/cloud-ai/presentation/generation-route.ts");
  const entrypoint = read("src/app/api/creator/generation-jobs/[jobId]/retry/route.ts");
  assert.match(route, /retryGenerationJob/);
  assert.match(route, /enforceCloudAiRateLimit/);
  assert.match(route, /retryFailedInteractiveCloudGenerationJob/);
  assert.match(route, /status: 202/);
  assert.match(route, /toApiError/);
  assert.match(entrypoint, /retryGenerationJob as POST/);
});

test("Canvasの再実行ボタンは同じPromptを再構築せず失敗Job IDを送る", () => {
  const editor = read("src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx");
  const client = read("src/app/creator/[projectId]/pages/[pageId]/services/creator-api.ts");
  const handlerStart = editor.indexOf("async function retryFailedPanelGeneration");
  const handlerEnd = editor.indexOf("function movePanelLayer", handlerStart);
  const handler = editor.slice(handlerStart, handlerEnd);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  assert.match(handler, /retryGeneration\(job\.id\)/);
  assert.doesNotMatch(handler, /requestStoryboardPanelGeneration/);
  assert.match(editor, /onClick=\{\(\) => void retryFailedPanelGeneration\(job\)\}/);
  assert.match(client, /generation-jobs\/\$\{encodeURIComponent\(jobId\)\}\/retry/);
  assert.match(client, /method: "POST"/);
});

test("失敗Jobの再実行は同じコマの進行中Jobだけを待ち確認済み・確認待ち候補で停止しない", () => {
  const editor = read("src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx");
  const failedStart = editor.indexOf('{job.status === "failed"');
  const completedStart = editor.indexOf('{job.status === "completed"', failedStart);
  const failedCard = editor.slice(failedStart, completedStart);

  assert.ok(failedStart >= 0 && completedStart > failedStart);
  assert.match(failedCard, /hasActivePanelGeneration/);
  assert.doesNotMatch(failedCard, /hasUnresolvedPanelGeneration/);
});
