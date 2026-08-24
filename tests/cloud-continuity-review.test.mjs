import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateCloudContinuity } from "../src/lib/cloud-continuity-review.ts";

const pageId = "10000000-0000-4000-8000-000000000001";
const panelId = "20000000-0000-4000-8000-000000000001";
const characterId = "30000000-0000-4000-8000-000000000001";
const referenceId = "40000000-0000-4000-8000-000000000001";
const styleId = "50000000-0000-4000-8000-000000000001";

function review(jobInput) {
  return evaluateCloudContinuity({
    placements: [{ pageId, pageNumber: 3, panelId, sourceJobId: "job-1", assetId: "asset-1", assetSha256: "a".repeat(64), jobInput }],
    assignments: [{ pageId, panelId, subjectId: characterId, kind: "character" }],
    subjects: [{
      id: characterId,
      name: "主人公",
      kind: "character",
      currentVersion: 2,
      referenceAssetIds: [referenceId],
    }],
    style: { id: styleId, currentVersion: 4, referenceAssetIds: [] },
  });
}

test("現在の人物・参照画像・画風設定を使った生成は警告なし", () => {
  const result = review({
    characterProfileVersions: [{ profileId: characterId, version: 2 }],
    styleBibleVersion: { bibleId: styleId, version: 4 },
    referenceAssetIds: [referenceId],
  });
  assert.equal(result.warningCount, 0);
  assert.equal(result.reviewedPanelCount, 1);
});

test("古い人物設定と参照画像漏れを利用者向け警告にする", () => {
  const result = review({
    characterProfileVersions: [{ profileId: characterId, version: 1 }],
    styleBibleVersion: { bibleId: styleId, version: 4 },
    referenceAssetIds: [],
  });
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["subject_version_outdated", "subject_reference_missing"],
  );
  assert.match(result.issues[0].message, /現在のv2/);
});

test("自動照合された人物も明示割当なしでversionを確認する", () => {
  const result = evaluateCloudContinuity({
    placements: [{
      pageId,
      pageNumber: 3,
      panelId,
      sourceJobId: "job-1",
      assetId: "asset-1",
      assetSha256: "a".repeat(64),
      jobInput: {
        characterProfileVersions: [{ profileId: characterId, version: 1 }],
        referenceAssetIds: [],
      },
    }],
    assignments: [],
    subjects: [{
      id: characterId,
      name: "主人公",
      kind: "character",
      currentVersion: 2,
      referenceAssetIds: [],
    }],
    style: null,
  });
  assert.equal(result.issues[0].code, "subject_version_outdated");
  assert.equal(result.infoCount, 0);
});

test("同一または隣接ページの完全一致画像だけをread-only目視候補にする", () => {
  const placements = [
    { pageId: "page-1", pageNumber: 1, panelId: "panel-1", sourceJobId: "job-1", assetId: "asset-1", assetSha256: "a".repeat(64), jobInput: {} },
    { pageId: "page-2", pageNumber: 2, panelId: "panel-2", sourceJobId: "job-2", assetId: "asset-2", assetSha256: "a".repeat(64), jobInput: {} },
    { pageId: "page-4", pageNumber: 4, panelId: "panel-4", sourceJobId: "job-4", assetId: "asset-1", assetSha256: "a".repeat(64), jobInput: {} },
  ];
  const result = evaluateCloudContinuity({ placements, assignments: [], subjects: [], style: null });
  assert.equal(result.visualCandidateCount, 1);
  assert.equal(result.visualCandidates[0].code, "duplicate_digest");
  assert.equal(result.warningCount, 0);
  assert.match(result.visualCandidates[0].message, /目視確認/);
});

test("同じAsset IDの再利用を完全一致digestより優先して候補化する", () => {
  const placements = [
    { pageId: "page-1", pageNumber: 1, panelId: "panel-1", sourceJobId: "job-1", assetId: "asset-1", assetSha256: "a".repeat(64), jobInput: {} },
    { pageId: "page-1", pageNumber: 1, panelId: "panel-2", sourceJobId: "job-2", assetId: "asset-1", assetSha256: "a".repeat(64), jobInput: {} },
  ];
  const result = evaluateCloudContinuity({ placements, assignments: [], subjects: [], style: null });
  assert.equal(result.visualCandidates[0].code, "duplicate_asset");
  assert.equal(result.warningCount, 0);
});

test("一貫性画面は判定範囲と修正導線を明示する", async () => {
  const page = await readFile(
    "src/app/creator/[projectId]/continuity/page.tsx",
    "utf8",
  );
  assert.match(page, /画像の見た目そのものを判定する機能ではありません/);
  assert.match(page, /同じAsset IDか完全一致SHA-256/);
  assert.match(page, /完成阻害、自動不採用、自動再生成は行いません/);
  assert.match(page, /参照画像と割当を確認/);
  assert.match(page, /ページを開く/);
});
