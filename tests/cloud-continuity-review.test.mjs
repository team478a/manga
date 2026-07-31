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
    placements: [{ pageId, pageNumber: 3, panelId, sourceJobId: "job-1", jobInput }],
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

test("一貫性画面は判定範囲と修正導線を明示する", async () => {
  const page = await readFile(
    "src/app/creator/[projectId]/continuity/page.tsx",
    "utf8",
  );
  assert.match(page, /画像の見た目そのものを判定する機能ではありません/);
  assert.match(page, /参照画像と割当を確認/);
  assert.match(page, /ページを開く/);
});
