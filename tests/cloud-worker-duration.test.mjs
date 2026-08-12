import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) =>
  fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("長時間Workerと同期Export fallbackは実行時間を明示する", () => {
  const routes = new Map([
    ["src/app/api/internal/cloud-ai/worker/route.ts", 240],
    ["src/app/api/internal/cloud-export/worker/route.ts", 300],
    ["src/app/api/internal/cloud-storage/worker/route.ts", 180],
    ["src/app/api/creator/projects/[projectId]/export/route.ts", 300],
  ]);
  for (const [path, seconds] of routes)
    assert.match(
      read(path),
      new RegExp(`export const maxDuration = ${seconds};`),
      `${path} must declare its execution budget`,
    );
});

test("Worker処理は実行上限内で失敗を記録し再試行可能にする", () => {
  const imageProvider = read(
    "src/modules/cloud-ai/infrastructure/bfl-provider.ts",
  );
  const gatewayProvider = read(
    "src/modules/cloud-ai/infrastructure/gateway-provider.ts",
  );
  const aiWorker = read(
    "src/modules/cloud-ai/application/process-generation.ts",
  );
  const retryPolicy = read("src/modules/cloud-ai/domain/retry-policy.ts");
  const exportWorker = read(
    "src/modules/cloud-creator/export/process-export-segment.ts",
  );
  const exportPlan = read("src/modules/cloud-creator/export/export-plan.ts");
  const exportRepository = read(
    "src/modules/cloud-creator/export/manga-export-repository.ts",
  );
  const storageWorker = read("src/lib/cloud-storage-lifecycle-worker.ts");

  assert.match(imageProvider, /timeoutMs \?\? DEFAULT_BFL_TIMEOUT_MS/);
  assert.match(imageProvider, /DEFAULT_BFL_TIMEOUT_MS = 210_000/);
  assert.match(gatewayProvider, /timeoutMs \?\? 120_000/);
  assert.match(retryPolicy, /shouldRetryCloudGeneration/);
  assert.match(aiWorker, /shouldRetryGeneration/);
  assert.match(aiWorker, /status: retryable \? \("retrying" as const\) : \("failed" as const\)/);
  assert.match(exportPlan, /slice\(/);
  assert.match(exportWorker, /failExportJob/);
  assert.match(exportRepository, /p_retryable: true/);
  assert.match(storageWorker, /fail_cloud_page_thumbnail/);
  assert.match(storageWorker, /fail_cloud_storage_cleanup/);
});

test("編集画面は同期全ページExportを直接起動しない", () => {
  const editor = read(
    "src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx",
  );
  assert.doesNotMatch(editor, /creatorProjectExportUrl/);
  assert.doesNotMatch(editor, /api\/creator\/projects\/.*\/export/);
  assert.match(editor, /#durable-export/);
  assert.match(editor, /安全な完成PDF書き出しへ/);
});
