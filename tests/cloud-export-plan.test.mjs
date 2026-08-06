import assert from "node:assert/strict";
import test from "node:test";
import {
  exportJobPath,
  exportPageFileName,
  planExportSegment,
  visibleCanvasAssetIds,
} from "../src/modules/cloud-creator/export/export-plan.ts";

const job = {
  id: "job-1",
  projectId: "project-1",
  ownerProfileId: "profile-1",
  pageIds: ["p1", "p2", "p3", "p4", "p5"],
  totalPages: 5,
  completedPages: 0,
  segmentSize: 4,
  leaseToken: "lease-1",
};

test("Export planは4ページsegmentと既存Storage pathを決定する", () => {
  assert.deepEqual(planExportSegment(job), {
    pageIds: ["p1", "p2", "p3", "p4"],
    segmentIndex: 0,
    completedPages: 4,
    isFinal: false,
  });
  assert.deepEqual(
    planExportSegment({ ...job, completedPages: 4 }),
    {
      pageIds: ["p5"],
      segmentIndex: 1,
      completedPages: 5,
      isFinal: true,
    },
  );
  assert.equal(exportPageFileName(8), "008.png");
  assert.equal(
    exportJobPath(job, "manuscript.pdf"),
    "profile-1/project-1/job-1/manuscript.pdf",
  );
});

test("Export planは非表示layerを除外し分離layerをlegacy画像より優先する", () => {
  const ids = visibleCanvasAssetIds({
    pageId: "p1",
    width: 100,
    height: 100,
    backgroundColor: "#fff",
    panels: [
      { id: "a", pageId: "p1", x: 0, y: 0, width: 50, height: 50, visible: true, orderIndex: 0, imageAssetId: "legacy-a" },
      { id: "b", pageId: "p1", x: 50, y: 0, width: 50, height: 50, visible: true, orderIndex: 1, imageAssetId: "legacy-b" },
      { id: "c", pageId: "p1", x: 0, y: 50, width: 50, height: 50, visible: false, orderIndex: 2, imageAssetId: "hidden-panel" },
    ],
    panelLayers: [
      { id: "l1", panelId: "a", type: "character", assetId: "character", visible: true, opacity: 1, blendMode: "normal", orderIndex: 0 },
      { id: "l2", panelId: "a", type: "effect", assetId: "hidden-layer", visible: false, opacity: 1, blendMode: "normal", orderIndex: 1 },
      { id: "l3", panelId: "b", type: "flattened_legacy", assetId: "legacy-b", visible: true, opacity: 1, blendMode: "normal", orderIndex: 0 },
    ],
    textLayers: [],
  });
  assert.deepEqual([...ids], ["character", "legacy-b"]);
});
