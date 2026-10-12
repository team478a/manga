import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCandidateProductionPresentation, candidateIsVisibleInCanvas, missingPanelGenerationCounts } from "../src/modules/manga/domain/candidate-production-presentation.ts";
import { createFourPageCompletionFixture } from "./fixtures/manga-page-completion-four-page.mjs";

const source = createFourPageCompletionFixture()[0];
const job = (overrides = {}) => ({ id: "job-1", kind: "image", page_id: source.pageId, status: "completed", target_panel_id: source.canvas.panels[0].id, output_asset_id: source.canvas.panels[0].imageAssetId, panel_adoption_status: null, panel_adoption_retryable: false, quality_review_status: null, failed_retry_recovery: "retryable", ...overrides });
const canvas = () => structuredClone(source.canvas);

test("generation success is not adoption, placement or manuscript completion", () => {
  const value = canvas(); value.panels[0].imageAssetId = null;
  assert.deepEqual(buildCandidateProductionPresentation(job(), value, true), { generationLabel: "画像生成結果を保存済み", adoptionLabel: "採用・品質確認待ち", placementLabel: "未配置" });
  assert.equal(buildCandidateProductionPresentation(job({ output_asset_id: null }), value, true).generationLabel, "生成結果の画像を確認できません");
});

test("local adoption, saved placement and remote placement are independent", () => {
  assert.equal(buildCandidateProductionPresentation(job({ quality_review_status: "approved" }), canvas(), false).placementLabel, "編集中のCanvasへ配置済み・未保存");
  assert.equal(buildCandidateProductionPresentation(job(), canvas(), true).placementLabel, "表示用Canvasに配置・保存済み");
  const value = canvas(); value.panels[0].imageAssetId = null;
  assert.equal(buildCandidateProductionPresentation(job({ panel_adoption_status: "auto_placed" }), value, true).placementLabel, "保存先は配置済み・この画面では表示未確認");
  assert.equal(buildCandidateProductionPresentation(job({ panel_adoption_status: "placement_failed", panel_adoption_retryable: true }), value, true).placementLabel, "配置失敗・配置の再試行が必要（追加生成なし）");
  assert.equal(buildCandidateProductionPresentation(job({ panel_adoption_status: "placement_failed", quality_review_status: "approved" }), value, true).adoptionLabel, "採用確認済み");
});

test("hidden, transparent, replaced and other-page images are not current visible placement", () => {
  for (const mutate of [value => { value.panels[0].visible = false; }, value => { value.panels[0].imageOpacity = 0; }, value => { value.panels[0].imageAssetId = "other"; }, value => { value.pageId = "other"; }]) {
    const value = canvas(); mutate(value); assert.equal(candidateIsVisibleInCanvas(job(), value), false);
  }
  for (const layer of [{ visible: false, opacity: 1 }, { visible: true, opacity: 0 }, { visible: true, opacity: 1, assetId: "other" }]) {
    const value = canvas(); value.panelLayers = [{ panelId: value.panels[0].id, type: "background", sourceJobId: "job-1", assetId: job().output_asset_id, ...layer }];
    assert.equal(candidateIsVisibleInCanvas(job(), value), false);
  }
  const value = canvas(); value.panels[0].imageAssetId = null;
  value.panelLayers = [{ panelId: value.panels[0].id, type: "background", visible: true, opacity: 1, assetId: job().output_asset_id }];
  assert.equal(candidateIsVisibleInCanvas(job(), value), true);
});

test("rejection remains rejection even for a saved automatic placement", () => {
  for (const rejected of [{ quality_review_status: "rejected" }, { panel_adoption_status: "rejected", quality_review_status: "approved" }])
    assert.equal(buildCandidateProductionPresentation(job({ panel_adoption_status: "auto_placed", ...rejected }), canvas(), true).adoptionLabel, "不採用");
});

test("missing-panel notices ignore other pages, removed panels and resolved historical failures", () => {
  const value = canvas(); value.panels[0].imageAssetId = null;
  const jobs = [job({ status: "failed" }), job(), job({ page_id: "other", status: "running" }), job({ target_panel_id: "removed", status: "running" }), job({ target_panel_id: value.panels[1].id, status: "failed" })];
  assert.deepEqual(missingPanelGenerationCounts(value, jobs), { missingPanelCount: 1, activeCount: 0, failedCount: 0, completedCount: 1 });
  assert.equal(missingPanelGenerationCounts(value, [job({ quality_review_status: "rejected" })]).completedCount, 0);
});

test("failed generation recovery labels never promise unavailable retries", () => {
  assert.equal(buildCandidateProductionPresentation(job({ status: "failed", failed_retry_recovery: "edit_required" }), canvas(), true).generationLabel, "生成失敗・条件の確認が必要");
  assert.equal(buildCandidateProductionPresentation(job({ status: "running" }), canvas(), true).generationLabel, "生成中");
  assert.equal(buildCandidateProductionPresentation(job({ status: "canceled" }), canvas(), true).generationLabel, "中止");
});

test("the UI separates stages and never promises reload will always place images", () => {
  const editor = fs.readFileSync(new URL("../src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx", import.meta.url), "utf8");
  const notice = fs.readFileSync(new URL("../src/app/creator/[projectId]/pages/[pageId]/CanvasImageGenerationNotice.tsx", import.meta.url), "utf8");
  assert.match(editor, /candidate-production-stages/);
  assert.match(editor, /原稿完成は別判定/);
  assert.match(editor, /生成工程/);
  assert.doesNotMatch(notice, /完了後に再読み込みすると原稿へ反映/);
  assert.match(notice, /配置は追加生成ではありません/);
});
