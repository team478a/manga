import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { createPagesPdf } from "../packages/export-core/src/index.ts";
import { renderCloudCanvasPng } from "../src/lib/cloud-canvas-render.ts";
import {
  evaluateMangaPageCompletion,
  hasUnresolvedPanelAdoptionReview,
  summarizeMangaProjectCompletion,
} from "../src/modules/manga/domain/page-completion.ts";
import { createFourPageCompletionFixture } from "./fixtures/manga-page-completion-four-page.mjs";

const pages = createFourPageCompletionFixture();
const source = pages[0];
const clone = (value) => structuredClone(value);
const input = (overrides = {}) => ({
  pageId: source.pageId,
  pageWidth: source.width,
  pageHeight: source.height,
  canvas: clone(source.canvas),
  savedRevision: 3,
  currentRevision: 3,
  requiredDialogues: clone(source.dialogues),
  imageJobs: clone(source.imageJobs),
  availableAssetIds: new Set(source.assetIds),
  pngRenderSucceeded: true,
  manualReviewRequired: false,
  ...overrides,
});
const codes = (result) => new Set(result.blockers.map((blocker) => blocker.code));

test("4ページfixtureは全ページcompleteになり作品完成率100%になる", () => {
  const results = pages.map((page) => ({
    ...evaluateMangaPageCompletion({ ...input(), pageId: page.pageId, pageWidth: page.width, pageHeight: page.height, canvas: clone(page.canvas), requiredDialogues: clone(page.dialogues), imageJobs: clone(page.imageJobs), availableAssetIds: new Set(page.assetIds) }),
    pageId: page.pageId,
    pageNumber: page.pageNumber,
  }));
  assert.ok(results.every((result) => result.complete));
  assert.deepEqual(summarizeMangaProjectCompletion(results), {
    complete: true, totalPages: 4, completedPages: 4, generatingPages: 0,
    incompletePages: 0, reviewRequiredPages: 0, failedPages: 0, completionPercent: 100,
  });
});

test("画像不足と非表示画像だけのコマを検出する", () => {
  const canvas = clone(source.canvas);
  canvas.panels[0].imageAssetId = null;
  assert.ok(codes(evaluateMangaPageCompletion(input({ canvas }))).has("PANEL_IMAGE_MISSING"));
  canvas.panelLayers.push({ id: "10000000-0000-4000-8000-000000000001", panelId: canvas.panels[1].id, name: "hidden", type: "background", orderIndex: 0, visible: false, locked: false, opacity: 1, blendMode: "normal", assetId: source.assetIds[1], sourceJobId: null, imageFit: "cover", imageOffsetX: 0, imageOffsetY: 0, imageScale: 1, imageRotation: 0, createdAt: "", updatedAt: "" });
  assert.equal(evaluateMangaPageCompletion(input({ canvas })).panelImageCount, 0);
});

test("生成済み未配置と同じ画像の複数コマ流用を完成扱いにしない", () => {
  const jobs = clone(source.imageJobs);
  jobs[0].outputAssetId = pages[1].assetIds[0];
  assert.ok(codes(evaluateMangaPageCompletion(input({ imageJobs: jobs }))).has("PANEL_IMAGE_MISSING"));
  const canvas = clone(source.canvas);
  canvas.panels[1].imageAssetId = canvas.panels[0].imageAssetId;
  const result = evaluateMangaPageCompletion(input({ canvas, availableAssetIds: new Set([canvas.panels[0].imageAssetId]) }));
  assert.ok(codes(result).has("MANUAL_REVIEW_REQUIRED"));
});

test("明示的に全候補を不採用にした生成群は未配置blockerを残さない", () => {
  const jobs = clone(source.imageJobs);
  jobs[0].candidateOutputAssetIds = [pages[1].assetIds[0], pages[1].assetIds[1]];
  jobs[0].candidateJobIds = [
    "10000000-0000-4000-8000-000000000091",
    "10000000-0000-4000-8000-000000000092",
  ];
  const onlyOneRejected = evaluateMangaPageCompletion(input({
    imageJobs: jobs,
    rejectedGenerationJobIds: new Set([jobs[0].candidateJobIds[0]]),
  }));
  assert.ok(codes(onlyOneRejected).has("PANEL_IMAGE_MISSING"));

  const allRejected = evaluateMangaPageCompletion(input({
    imageJobs: jobs,
    rejectedGenerationJobIds: new Set(jobs[0].candidateJobIds),
  }));
  assert.equal(codes(allRejected).has("PANEL_IMAGE_MISSING"), false);
});

test("pending Jobはgenerating、failed Jobはincompleteになる", () => {
  const pending = clone(source.imageJobs); pending[0].status = "running";
  const pendingResult = evaluateMangaPageCompletion(input({ imageJobs: pending }));
  assert.equal(pendingResult.status, "generating");
  assert.ok(codes(pendingResult).has("IMAGE_JOB_PENDING"));
  const failed = clone(source.imageJobs); failed[0].status = "failed";
  const failedResult = evaluateMangaPageCompletion(input({ imageJobs: failed }));
  assert.equal(failedResult.status, "incomplete");
  assert.ok(codes(failedResult).has("IMAGE_JOB_FAILED"));
});

test("別ページのJobを集計しない", () => {
  const foreign = { ...source.imageJobs[0], id: pages[1].imageJobs[0].id, pageId: pages[1].pageId, status: "failed" };
  const result = evaluateMangaPageCompletion(input({ imageJobs: [...source.imageJobs, foreign] }));
  assert.equal(result.failedGenerationCount, 0);
});

test("必須セリフ不足、空吹き出し、非表示テキストを検出する", () => {
  const canvas = clone(source.canvas);
  canvas.textObjects[0].text = " ";
  let result = evaluateMangaPageCompletion(input({ canvas }));
  assert.ok(codes(result).has("DIALOGUE_MISSING"));
  assert.ok(codes(result).has("BALLOON_TEXT_EMPTY"));
  canvas.textObjects[0] = clone(source.canvas.textObjects[0]);
  canvas.textObjects[0].visible = false;
  result = evaluateMangaPageCompletion(input({ canvas }));
  assert.ok(codes(result).has("DIALOGUE_MISSING"));
});

test("未保存、revision競合、Asset不足、PNG失敗、寸法不正を同時に返す", () => {
  const canvas = clone(source.canvas); canvas.width = 700;
  const result = evaluateMangaPageCompletion(input({ canvas, savedRevision: null, currentRevision: 4, availableAssetIds: new Set(), pngRenderSucceeded: false }));
  for (const code of ["CANVAS_NOT_SAVED", "REVISION_CONFLICT", "ASSET_UNAVAILABLE", "PNG_RENDER_FAILED", "PAGE_DIMENSION_INVALID"])
    assert.ok(codes(result).has(code), code);
  assert.ok(result.blockers.length > 1);
});

test("手動確認だけが残る場合はreview_requiredになる", () => {
  const result = evaluateMangaPageCompletion(input({ manualReviewRequired: true }));
  assert.equal(result.status, "review_required");
  assert.ok(codes(result).has("MANUAL_REVIEW_REQUIRED"));
});

test("品質承認済み候補がある生成単位は古いadoption確認待ちを残さない", () => {
  const selectedJobId = "10000000-0000-4000-8000-000000000081";
  const siblingJobId = "10000000-0000-4000-8000-000000000082";
  const statuses = new Map([
    [selectedJobId, "placement_failed"],
    [siblingJobId, "review_required"],
  ]);
  assert.equal(hasUnresolvedPanelAdoptionReview({
    candidateJobIds: [selectedJobId, siblingJobId],
    adoptionStatusByJobId: statuses,
    reviewedGenerationJobIds: new Set([selectedJobId]),
    rejectedGenerationJobIds: new Set(),
  }), false);
  assert.equal(hasUnresolvedPanelAdoptionReview({
    candidateJobIds: [selectedJobId, siblingJobId],
    adoptionStatusByJobId: statuses,
    reviewedGenerationJobIds: new Set(),
    rejectedGenerationJobIds: new Set([selectedJobId]),
  }), true);
  assert.equal(hasUnresolvedPanelAdoptionReview({
    candidateJobIds: [selectedJobId, siblingJobId],
    adoptionStatusByJobId: statuses,
    reviewedGenerationJobIds: new Set(),
    rejectedGenerationJobIds: new Set([selectedJobId, siblingJobId]),
  }), false);
});

test("自動配置した生成画像は目視確認までreview_requiredにする", () => {
  const canvas = clone(source.canvas);
  const generationJobId = source.imageJobs[0].id;
  canvas.panelLayers = [{
    id: "10000000-0000-4000-8000-000000000099",
    panelId: canvas.panels[0].id,
    name: "AI背景",
    type: "background",
    orderIndex: 0,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    assetId: source.assetIds[0],
    sourceJobId: generationJobId,
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    createdAt: "",
    updatedAt: "",
  }];
  const pending = evaluateMangaPageCompletion(input({
    canvas,
    reviewedGenerationJobIds: new Set(),
  }));
  assert.equal(pending.status, "review_required");
  assert.ok(codes(pending).has("IMAGE_QUALITY_REVIEW_REQUIRED"));
  const approved = evaluateMangaPageCompletion(input({
    canvas,
    reviewedGenerationJobIds: new Set([generationJobId]),
  }));
  assert.equal(codes(approved).has("IMAGE_QUALITY_REVIEW_REQUIRED"), false);
});

test("不採用Jobの画像がCanvasへ残るページは完成不可にする", () => {
  const canvas = clone(source.canvas);
  const generationJobId = source.imageJobs[0].id;
  canvas.panelLayers = [{
    id: "10000000-0000-4000-8000-000000000095",
    panelId: canvas.panels[0].id,
    name: "不採用AI背景",
    type: "background",
    orderIndex: 0,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    assetId: source.assetIds[0],
    sourceJobId: generationJobId,
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    createdAt: "",
    updatedAt: "",
  }];
  const result = evaluateMangaPageCompletion(input({
    canvas,
    reviewedGenerationAssetIds: new Set([source.assetIds[0]]),
    rejectedGenerationJobIds: new Set([generationJobId]),
  }));
  assert.equal(result.status, "incomplete");
  assert.ok(codes(result).has("IMAGE_QUALITY_REJECTED"));
});

test("同一生成Assetの確認結果は候補Job IDが異なっても完成判定へ反映する", () => {
  const canvas = clone(source.canvas);
  canvas.panelLayers = [{
    id: "10000000-0000-4000-8000-000000000098",
    panelId: canvas.panels[0].id,
    name: "AI背景",
    type: "background",
    orderIndex: 0,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    assetId: source.assetIds[0],
    sourceJobId: "10000000-0000-4000-8000-000000000097",
    imageFit: "cover",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageRotation: 0,
    createdAt: "",
    updatedAt: "",
  }];
  const result = evaluateMangaPageCompletion(input({
    canvas,
    reviewedGenerationJobIds: new Set([
      "10000000-0000-4000-8000-000000000096",
    ]),
    reviewedGenerationAssetIds: new Set([source.assetIds[0]]),
  }));
  assert.equal(codes(result).has("IMAGE_QUALITY_REVIEW_REQUIRED"), false);
});

test("4ページfixtureをPNGとPDFへ同じ順序・寸法で描画できる", async () => {
  const images = [];
  for (const page of pages) {
    const assets = new Map();
    for (const [index, id] of page.assetIds.entries()) {
      const bytes = await sharp({ create: { width: 80, height: 80, channels: 4, background: index ? "#2f6fdd" : "#d94d3d" } }).png().toBuffer();
      assets.set(id, { mimeType: "image/png", bytes: new Uint8Array(bytes) });
    }
    const png = await renderCloudCanvasPng(page.canvas, assets);
    const metadata = await sharp(Buffer.from(png)).metadata();
    assert.equal(metadata.width, page.width);
    assert.equal(metadata.height, page.height);
    images.push({ fileName: `${String(page.pageNumber).padStart(3, "0")}.png`, bytes: png, mimeType: "image/png", width: page.width, height: page.height });
  }
  const pdf = await createPagesPdf(images, { dpi: 300 });
  const parsed = await PDFDocument.load(pdf);
  assert.equal(parsed.getPageCount(), 4);
  assert.deepEqual(images.map((image) => image.fileName), ["001.png", "002.png", "003.png", "004.png"]);
});

test("previewとserver guardは保存済みCanvas、object-contain、owner RLSを使用する", () => {
  const preview = fs.readFileSync("src/app/creator/[projectId]/preview/ManuscriptPreview.tsx", "utf8");
  const service = fs.readFileSync("src/modules/cloud-creator/projects/page-completion-service.ts", "utf8");
  const generation = fs.readFileSync("src/modules/cloud-creator/generation/generation-service.ts", "utf8");
  const editor = fs.readFileSync("src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx", "utf8");
  const production = fs.readFileSync("src/modules/cloud-creator/production/production-status-service.ts", "utf8");
  const checkpoint = fs.readFileSync("src/modules/cloud-creator/projects/project-checkpoint-service.ts", "utf8");
  const durable = fs.readFileSync("src/modules/cloud-creator/export/durable-export-service.ts", "utf8");
  assert.match(preview, /object-contain/);
  assert.match(preview, /aria-label="前のページ"/);
  assert.match(preview, /sm:grid-cols-8/);
  assert.match(service, /cloud_canvas_snapshots/);
  assert.match(service, /採用済みStoryboardの必須セリフを確認できませんでした/);
  assert.match(service, /\.eq\("project_id", projectId\)/);
  assert.match(service, /storage\.from\("cloud-assets"\)\.download/);
  assert.match(service, /cloud_manga_quality_logs/);
  assert.match(service, /reviewedGenerationJobIds/);
  assert.match(service, /reviewedGenerationAssetIds/);
  assert.match(service, /rejectedGenerationJobIds/);
  assert.match(generation, /quality_review_status/);
  assert.match(generation, /event_type/);
  assert.match(editor, /この画像を品質確認済みにする/);
  assert.match(editor, /このコマだけ作り直す（1案）/);
  assert.match(editor, /この候補を使わず作り直す（1案）/);
  assert.match(editor, /品質確認を取り消して作り直す（1案）/);
  assert.match(editor, /前の候補とは異なる明瞭な構図で再制作する/);
  assert.match(editor, /event: "rejected"/);
  assert.match(editor, /この候補を不採用にする（追加生成なし）/);
  assert.match(editor, /PanelImageQualityReviewDialog/);
  assert.match(production, /getCloudPageCompletion/);
  assert.match(checkpoint, /assertCloudProjectComplete/);
  assert.match(durable, /assertCloudProjectComplete/);
});
