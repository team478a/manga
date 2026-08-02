import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { createPagesPdf, mergePagesPdfs } from "../packages/export-core/src/index.ts";
import { analyzeCloudManuscript } from "../src/lib/cloud-manuscript-preflight.ts";
import { buildCloudLongformCockpit, filterCloudCockpitStructure } from "../src/lib/cloud-longform-cockpit.ts";
import { buildCloudProductionProgress } from "../src/lib/cloud-production-progress.ts";
import { summarizeCloudCheckpointDiff } from "../src/modules/cloud-creator/projects/project-checkpoint-diff.ts";
import { makeCloudLongform100PageFixture } from "./fixtures/cloud-longform-100-page.mjs";

test("100ページ作品を章・シーン単位で集約し24ページずつ表示する", () => {
  const fixture = makeCloudLongform100PageFixture();
  const startedAt = performance.now();
  const cockpit = buildCloudLongformCockpit({
    episodes: fixture.episodes,
    pages: fixture.pages,
    longform: fixture.longform,
    productionStates: fixture.productionStates,
    facts: [],
    threads: [],
    issues: [],
    characterNames: ["主人公", "相棒"],
  });
  const firstBatch = filterCloudCockpitStructure({
    chapters: cockpit.chapters,
    unassignedPages: cockpit.unassignedPages,
    chapterId: "all",
    status: "all",
    limit: 24,
  });
  assert.equal(cockpit.totalPages, 100);
  assert.equal(cockpit.chapters.length, 10);
  assert.equal(cockpit.chapters.flatMap((chapter) => chapter.scenes).length, 20);
  assert.equal(cockpit.chapters.every((chapter) => chapter.pages.length === 10), true);
  assert.equal(cockpit.chapters.every((chapter) => chapter.scenes.every((scene) => scene.pages.length === 5)), true);
  assert.equal(cockpit.finalizedPages, 100);
  assert.equal(cockpit.completionPercent, 100);
  assert.equal(cockpit.unassignedPages.length, 0);
  assert.equal(firstBatch.totalMatches, 100);
  assert.equal(firstBatch.visiblePageIds.length, 24);
  assert.ok(performance.now() - startedAt < 5_000, "構造集約は5秒以内に完了する");
});

test("100ページ完成原稿を全件検査し制作進捗を完了にする", () => {
  const fixture = makeCloudLongform100PageFixture();
  const report = analyzeCloudManuscript({
    coverPageId: fixture.pages[0].id,
    pages: fixture.pages,
    assets: fixture.assets,
    targetPageCount: 100,
    productionStates: fixture.productionStates,
    activeGenerationPageIds: [],
    requireFinalizedPages: true,
  });
  const progress = buildCloudProductionProgress({ pages: report.pageProgress, jobs: [] });
  assert.equal(report.ready, true);
  assert.equal(report.pageCount, 100);
  assert.equal(report.targetPageCount, 100);
  assert.equal(report.totalPanelCount, 100);
  assert.equal(report.completedPanelCount, 100);
  assert.equal(report.errorCount, 0);
  assert.equal(report.pageProgress.length, 100);
  assert.equal(progress.completePageCount, 100);
  assert.equal(progress.generatingPageCount, 0);
  assert.equal(progress.failedPageCount, 0);
});

test("100ページ固定版は変更ページだけを復元対象として数える", () => {
  const fixture = makeCloudLongform100PageFixture();
  const manifest = {
    project: fixture.project,
    pages: fixture.pages.map((page) => ({ id: page.id, revision: page.revision })),
    chapters: fixture.chapters.map(({ id }) => ({ id })),
    episodes: fixture.episodes.map(({ id }) => ({ id })),
    scenes: fixture.scenes.map(({ id }) => ({ id })),
    assets: fixture.assets.map(({ id }) => ({ id })),
  };
  const currentPages = fixture.pages.map((page) => ({
    id: page.id,
    revision: page.page_number % 10 === 0 ? 2 : page.revision,
  }));
  currentPages.push({ id: "page-extra", revision: 1 });
  const diff = summarizeCloudCheckpointDiff(manifest, {
    project: fixture.project,
    pages: currentPages,
    chapters: fixture.chapters.map(({ id }) => ({ id })),
    episodes: fixture.episodes.map(({ id }) => ({ id })),
    scenes: fixture.scenes.map(({ id }) => ({ id })),
    assets: fixture.assets.map(({ id }) => ({ id })),
  });
  assert.deepEqual(diff, {
    available: true,
    pagesToRestore: 10,
    pagesToRemove: 1,
    structureChanges: 0,
    assetChanges: 0,
    projectSettingsChanged: false,
    hasChanges: true,
  });
});

test("100ページを4ページ25分割でPDFへ結合できる", async () => {
  const png = new Uint8Array(await sharp({
    create: { width: 16, height: 24, channels: 3, background: "#ffffff" },
  }).png().toBuffer());
  const segmentPdfs = [];
  for (let segmentIndex = 0; segmentIndex < 25; segmentIndex += 1) {
    const images = Array.from({ length: 4 }, (_, index) => {
      const pageNumber = segmentIndex * 4 + index + 1;
      return {
        fileName: `${String(pageNumber).padStart(3, "0")}.png`,
        bytes: png,
        mimeType: "image/png",
        width: 16,
        height: 24,
      };
    });
    segmentPdfs.push(await createPagesPdf(images, { dpi: 300 }));
  }
  const merged = await mergePagesPdfs(segmentPdfs);
  const document = await PDFDocument.load(merged);
  assert.equal(segmentPdfs.length, 25);
  assert.equal(document.getPageCount(), 100);
  assert.ok(merged.byteLength > 0);
});
