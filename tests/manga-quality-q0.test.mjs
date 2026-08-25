import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { calculateMangaQualityMetrics } from "../src/modules/manga-quality/application/quality-metrics.ts";
import { isMangaQualityFailureCategory } from "../src/modules/manga-quality/domain/failure-category.ts";
import { isNonRecordableDisplayedEventError } from "../src/modules/manga-quality/domain/quality-event-error.ts";

const row = (overrides = {}) => ({
  candidateDisplayed: true,
  candidateSelected: false,
  failureCategories: [],
  providerId: "black-forest-labs",
  modelId: "flux-2-pro",
  pageId: "page-1",
  actualCostMicros: 100,
  repaired: false,
  retryCount: 0,
  ...overrides,
});

test("Q0 failure categoryは既知値だけを受け入れる", () => {
  assert.equal(isMangaQualityFailureCategory("face_mismatch"), true);
  assert.equal(isMangaQualityFailureCategory("prompt_leak"), false);
});

test("Q0 KPIは採用率、再生成、修正、failure categoryを決定的に集計する", () => {
  const metrics = calculateMangaQualityMetrics([
    row({ candidateSelected: true, failureCategories: ["hand_error"] }),
    row({ repaired: true, retryCount: 2, failureCategories: ["hand_error", "wrong_camera"] }),
    row({ candidateDisplayed: false }),
  ]);
  assert.equal(metrics.candidates, 3);
  assert.equal(metrics.initialSelectionRate, 0.5);
  assert.equal(metrics.averageRetryCount, 2 / 3);
  assert.equal(metrics.averageRepairCount, 1 / 3);
  assert.equal(metrics.failureCategoryRates.hand_error, 2 / 3);
  assert.equal(metrics.failureCategoryRates.wrong_camera, 1 / 3);
  assert.equal(metrics.providerSelectionRates["black-forest-labs"], 0.5);
  assert.equal(metrics.modelSelectionRates["flux-2-pro"], 0.5);
  assert.equal(metrics.averageAiCostMicrosPerPage, 300);
  assert.equal(metrics.averageCostMicrosPerSelectedPanel, 100);
  assert.equal(metrics.averageCompletionTimeMs, 0);
  assert.equal(metrics.majorCharacterMismatchRate, 0);
  assert.equal(metrics.generationFailureRate, 0);
});

test("Q0は既存生成APIを変えず専用presentationとrepositoryへ入る", async () => {
  const route = await readFile(
    new URL("../src/app/api/creator/manga-quality-events/route.ts", import.meta.url),
    "utf8",
  );
  const repository = await readFile(
    new URL("../src/modules/manga-quality/infrastructure/manga-quality-repository.ts", import.meta.url),
    "utf8",
  );
  const editor = await readFile(
    new URL("../src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../supabase/migrations/202608080001_cloud_manga_quality_logs.sql", import.meta.url),
    "utf8",
  );
  assert.match(route, /manga-quality\/presentation\/quality-event-route/);
  assert.match(repository, /record_cloud_manga_quality_event/);
  assert.match(editor, /event: "displayed"/);
  assert.match(editor, /event: "selected"/);
  assert.match(editor, /\.catch\(\(\) => undefined\)/);
  assert.doesNotMatch(
    editor,
    /recordedDisplayedJobIds\.current\.delete\(job\.id\)/,
  );
  assert.match(migration, /unique \(generation_job_id, event_type\)/);
  assert.match(migration, /on conflict \(generation_job_id, event_type\) do nothing/);
  assert.doesNotMatch(migration, /grant select, insert, update .* authenticated/);
});

test("表示イベントは所有者として記録不能な旧Jobだけを非致命化する", () => {
  assert.equal(
    isNonRecordableDisplayedEventError({
      code: "P0001",
      message: "cloud_generation_job_not_found",
    }),
    true,
  );
  assert.equal(
    isNonRecordableDisplayedEventError({
      code: "P0001",
      message: "cloud_manga_quality_event_invalid",
    }),
    false,
  );
  assert.equal(
    isNonRecordableDisplayedEventError({
      code: "42P01",
      message: "cloud_generation_job_not_found",
    }),
    false,
  );
});
