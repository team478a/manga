import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("コマ生成RouteはManga presentation境界からapplicationへ入る", async () => {
  const route = await read("src/app/api/creator/storyboard-panel-generation/route.ts");
  const presentation = await read("src/modules/manga/presentation/panel-generation-route.ts");
  const application = await read("src/modules/manga/application/enqueue-panel-candidates.ts");

  assert.match(route, /@\/modules\/manga\/presentation\/panel-generation-route/);
  assert.doesNotMatch(route, /cloud-panel-image-generation-server/);
  assert.match(presentation, /application\/enqueue-panel-candidates/);
  assert.match(application, /enqueueCloudGenerationJob/);
  assert.match(application, /candidateIndex < request\.candidateCount/);
});

test("旧入口と公開schemaは互換性を維持する", async () => {
  const legacy = await read("src/lib/cloud-panel-image-generation-server.ts");
  const contract = await read("src/modules/manga/contracts/panel-generation.ts");
  const batch = await read("src/modules/manga/application/manage-generation-batch.ts");

  assert.match(legacy, /modules\/manga\/application\/enqueue-panel-candidates/);
  assert.match(contract, /cloudPanelImageGenerationRequestSchema/);
  assert.match(batch, /@\/lib\/cloud-panel-image-generation-server/);
});

test("生成契約、外部境界、候補部分成功を移動後も保持する", async () => {
  const application = await read("src/modules/manga/application/enqueue-panel-candidates.ts");

  for (const invariant of [
    "cloudPanelImageGenerationFeatureEnabled",
    "cloudPanelInpaintingFeatureEnabled",
    "cloudPanelOutpaintingFeatureEnabled",
    "cloudPanelImageGenerationRequestSchema.parse",
    "consumeCloudGeneralMonitorAiRequest",
    "buildStoryboardPanelGeneration",
    "partial = true",
    "enqueueCloudGenerationJob",
  ]) assert.match(application, new RegExp(invariant.replaceAll(".", "\\.")));
  assert.doesNotMatch(application, /console\.log/);
});
