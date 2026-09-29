import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCloudReleaseCheckpointGuidance } from "../src/lib/cloud-release-checkpoint-guidance.ts";

test("完成条件を取得できない場合は固定をfail closedにする", () => {
  assert.deepEqual(buildCloudReleaseCheckpointGuidance(null), {
    available: false,
    blockers: [],
    errorCount: 0,
    ready: false,
    summary: "完成条件を確認できないため、完成版を固定できません。",
  });
});

test("完成版固定の主要な阻害理由を件数で案内する", () => {
  const guidance = buildCloudReleaseCheckpointGuidance({
    errorCount: 9,
    issueCountByCode: {
      empty_panel: 4,
      generation_active: 1,
      page_not_finalized: 2,
      page_stale: 2,
    },
    ready: false,
  });

  assert.equal(guidance.available, true);
  assert.equal(guidance.ready, false);
  assert.match(guidance.summary, /要修正9件/);
  assert.deepEqual(
    guidance.blockers.map(({ code, count }) => ({ code, count })),
    [
      { code: "empty_panel", count: 4 },
      { code: "generation_active", count: 1 },
      { code: "page_not_finalized", count: 2 },
      { code: "page_stale", count: 2 },
    ],
  );
});

test("原稿チェック合格時だけ完成版固定を許可する", () => {
  const guidance = buildCloudReleaseCheckpointGuidance({
    errorCount: 0,
    issueCountByCode: {},
    ready: true,
  });

  assert.equal(guidance.ready, true);
  assert.equal(guidance.blockers.length, 0);
  assert.match(guidance.summary, /完成版を固定できます/);
});

test("作品画面は詳細案内を完成版固定buttonへ接続する", async () => {
  const [page, panel] = await Promise.all([
    readFile("src/app/creator/[projectId]/page.tsx", "utf8"),
    readFile("src/app/creator/[projectId]/ProjectCheckpointPanel.tsx", "utf8"),
  ]);

  assert.match(page, /buildCloudReleaseCheckpointGuidance\(exportReadiness\)/);
  assert.match(page, /releaseGuidance=\{releaseGuidance\}/);
  assert.match(panel, /disabled=\{!releaseGuidance\.ready\}/);
  assert.match(panel, /release-checkpoint-readiness/);
  assert.match(panel, /原稿チェックを確認/);
});
