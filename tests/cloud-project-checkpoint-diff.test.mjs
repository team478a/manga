import assert from "node:assert/strict";
import test from "node:test";
import { summarizeCloudCheckpointDiff } from "../src/modules/cloud-creator/projects/project-checkpoint-diff.ts";

const current = {
  project: { title: "現在", description: "説明", readingDirection: "rtl", width: 1200, height: 1800, dpi: 300 },
  pages: [{ id: "p1", revision: 4 }, { id: "p3", revision: 1 }],
  chapters: [{ id: "c1" }], episodes: [{ id: "e1" }], scenes: [{ id: "s1" }], assets: [{ id: "a1" }],
};

test("checkpointと現在作品の利用者向け差分件数を決定的に集計する", () => {
  const diff = summarizeCloudCheckpointDiff({
    project: { title: "過去", description: "説明", readingDirection: "rtl", width: 1200, height: 1800, dpi: 300 },
    pages: [{ id: "p1", revision: 2 }, { id: "p2", revision: 1 }],
    chapters: [{ id: "c1" }, { id: "c2" }], episodes: [{ id: "e1" }], scenes: [], assets: [{ id: "a2" }],
  }, current);
  assert.deepEqual(diff, {
    available: true,
    pagesToRestore: 2,
    pagesToRemove: 1,
    structureChanges: 2,
    assetChanges: 2,
    projectSettingsChanged: true,
    hasChanges: true,
  });
});

test("同一内容では差分なしを返す", () => {
  const diff = summarizeCloudCheckpointDiff({
    project: { title: "現在", description: "説明", readingDirection: "rtl", width: 1200, height: 1800, dpi: 300 },
    pages: [{ id: "p1", revision: 4 }, { id: "p3", revision: 1 }],
    chapters: [{ id: "c1" }], episodes: [{ id: "e1" }], scenes: [{ id: "s1" }], assets: [{ id: "a1" }],
  }, current);
  assert.equal(diff.available, true);
  assert.equal(diff.hasChanges, false);
});

test("不正なmanifestは推測せず差分取得不可にする", () => {
  assert.equal(summarizeCloudCheckpointDiff({ pages: [] }, current).available, false);
  assert.equal(summarizeCloudCheckpointDiff({
    project: {}, pages: [{ id: "p1" }], chapters: [], episodes: [], scenes: [], assets: [],
  }, current).available, false);
  assert.equal(summarizeCloudCheckpointDiff({
    project: {}, pages: [], chapters: [{ invalid: true }], episodes: [], scenes: [], assets: [],
  }, current).available, false);
});
